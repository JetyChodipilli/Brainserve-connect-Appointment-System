package com.brainserve.appointment.workinsight.application;

import com.brainserve.appointment.audit.api.AuditService;
import com.brainserve.appointment.employee.api.EmployeeDirectory;
import com.brainserve.appointment.departmenthr.api.DepartmentHrDirectory;
import com.brainserve.appointment.iam.api.StaffCommunicationDirectory;
import com.brainserve.appointment.manager.api.ManagerDirectory;
import com.brainserve.appointment.shared.application.BusinessException;
import com.brainserve.appointment.workinsight.api.WorkInsightEvents;
import com.brainserve.appointment.workinsight.domain.WorkTaskAuditRecord;
import com.brainserve.appointment.workinsight.infrastructure.WorkTaskAuditRecordRepository;
import com.brainserve.appointment.worktask.domain.DepartmentWorkTask;
import com.brainserve.appointment.worktask.domain.WorkTaskStatus;
import com.brainserve.appointment.worktask.infrastructure.DepartmentWorkTaskRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
public class WorkInsightService {
    private static final String HR = "ROLE_HR_ADMIN";
    private static final String MANAGER = "ROLE_MANAGER";
    private static final String CEO = "ROLE_CEO";
    private static final String SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";
    private final ZoneId officeZone;
    private final DepartmentWorkTaskRepository tasks;
    private final WorkTaskAuditRecordRepository audits;
    private final EmployeeDirectory employees;
    private final StaffCommunicationDirectory staff;
    private final ApplicationEventPublisher events;
    private final AuditService audit;
    private final DepartmentHrDirectory departmentHrs;
    private final ManagerDirectory managers;

    public WorkInsightService(DepartmentWorkTaskRepository tasks, WorkTaskAuditRecordRepository audits,
                              EmployeeDirectory employees, StaffCommunicationDirectory staff,
                              ApplicationEventPublisher events, AuditService audit,
                              DepartmentHrDirectory departmentHrs,
                              ManagerDirectory managers,
                              @Value("${brainserve.appointment.office-zone:Asia/Kolkata}") String officeZone) {
        this.tasks = tasks; this.audits = audits; this.employees = employees; this.staff = staff;
        this.events = events; this.audit = audit;
        this.departmentHrs = departmentHrs;
        this.managers = managers;
        this.officeZone = ZoneId.of(officeZone);
    }

    @Transactional(readOnly = true)
    public List<Insight> list(UUID actorUserId, LocalDate requestedWeek) {
        Set<String> roles = staff.requireActive(actorUserId).roles();
        LocalDate weekStart = normalizeWeek(requestedWeek);
        if (roles.contains(HR)) {
            UUID departmentId = departmentHrs.requireForUser(actorUserId).departmentId();
            Map<UUID, WorkTaskAuditRecord> retained = new HashMap<>();
            audits.findTop1000ByWeekStartOrderByHrAuditedAtDesc(weekStart)
                    .forEach(record -> retained.put(record.getWorkTaskId(), record));
            return tasks.findTop500ByDepartmentIdOrderByCreatedAtDesc(departmentId).stream()
                    .filter(task -> weekStart(task.getCreatedAt()).equals(weekStart))
                    .map(task -> liveInsight(task, retained.get(task.getId()))).toList();
        }
        if (roles.contains(MANAGER)) {
            UUID departmentId = managers.requireForUser(actorUserId).departmentId();
            return audits.findTop1000ByWeekStartAndDepartmentIdOrderByHrAuditedAtDesc(
                            weekStart, departmentId).stream()
                    .map(this::retainedInsight).toList();
        }
        if (roles.contains(CEO) || roles.contains(SYSTEM_ADMIN)) {
            return audits.findTop1000ByWeekStartOrderByHrAuditedAtDesc(weekStart).stream()
                    .map(this::retainedInsight).toList();
        }
        throw new BusinessException("WORK_INSIGHT_ROLE_REQUIRED",
                "Only Manager, HR, CEO and System Admin can view work insights", HttpStatus.FORBIDDEN);
    }

    @Transactional
    public Insight markAudited(UUID hrUserId, UUID workTaskId) {
        requireRole(hrUserId, HR, "Only HR can audit a worksheet");
        DepartmentWorkTask task = tasks.findById(workTaskId).orElseThrow(() -> new BusinessException(
                "WORK_TASK_NOT_FOUND", "The worksheet was not found", HttpStatus.NOT_FOUND));
        departmentHrs.requireAssignedReviewer(task.getDepartmentId(), hrUserId);
        if (task.getStatus() != WorkTaskStatus.APPROVED && task.getStatus() != WorkTaskStatus.ACKNOWLEDGED) {
            throw new BusinessException("WORK_INSIGHT_TASK_NOT_FINAL",
                    "HR can audit a worksheet only after Team Lead approval", HttpStatus.CONFLICT);
        }
        WorkTaskAuditRecord record = audits.findByWorkTaskId(workTaskId).orElse(null);
        if (record == null) record = audits.saveAndFlush(newRecord(task, hrUserId));
        else if (record.getAuditStatus() == com.brainserve.appointment.workinsight.domain.WorkInsightStatus.REWORK_ASSIGNED) {
            record.resubmit(hrUserId, task.getStatus().name());
        } else return retainedInsight(record);
        events.publishEvent(new WorkInsightEvents.HrAuditSubmitted(hrUserId,
                "HR audited worksheet ‘" + task.getTitle() + "’ for " + employee(task).displayName()
                        + " in " + task.getDepartmentBranch() + ". CEO approval is required."));
        audit.record("WORK_INSIGHT_HR_AUDITED", "WORK_TASK_AUDIT", record.getId().toString(),
                "{\"workTaskId\":\"" + task.getId() + "\"}");
        return retainedInsight(record);
    }

    @Transactional
    public Insight requestHrRework(UUID hrUserId, UUID workTaskId, String reason) {
        requireRole(hrUserId, HR, "Only HR can return an Insights worksheet for rework");
        DepartmentWorkTask task = requireFinalTask(workTaskId);
        departmentHrs.requireAssignedReviewer(task.getDepartmentId(), hrUserId);
        WorkTaskAuditRecord record = audits.findByWorkTaskId(workTaskId)
                .orElseGet(() -> audits.saveAndFlush(newRecord(task, hrUserId)));
        record.requestHrRework(hrUserId, reason);
        task.requestInsightRework("HR", reason);
        record.syncTaskStatus(task.getStatus().name());
        events.publishEvent(new WorkInsightEvents.ReworkRequested(hrUserId, task.getTeamLeadUserId(),
                "HR returned worksheet ‘" + task.getTitle() + "’ for rework. Flaws noted: " + reason.trim()
                        + ". Open Work Board and send corrective guidance to the employee."));
        audit.record("WORK_INSIGHT_HR_REWORK_REQUESTED", "WORK_TASK_AUDIT", record.getId().toString(),
                "{\"workTaskId\":\"" + task.getId() + "\",\"cycle\":" + record.getReworkCycle() + "}");
        return retainedInsight(record);
    }

    @Transactional
    public Insight assignRework(UUID teamLeadUserId, UUID workTaskId, String guidance) {
        WorkTaskAuditRecord record = audits.findByWorkTaskId(workTaskId).orElseThrow(() -> new BusinessException(
                "WORK_INSIGHT_NOT_FOUND", "The Insights rework request was not found", HttpStatus.NOT_FOUND));
        if (!record.getTeamLeadUserId().equals(teamLeadUserId)) throw new BusinessException(
                "WORK_INSIGHT_TEAM_LEAD_SCOPE_DENIED", "This rework request belongs to another Team Lead",
                HttpStatus.FORBIDDEN);
        DepartmentWorkTask task = tasks.findById(workTaskId).orElseThrow(() -> new BusinessException(
                "WORK_TASK_NOT_FOUND", "The worksheet was not found", HttpStatus.NOT_FOUND));
        task.assignInsightRework(guidance);
        record.assignRework(guidance, task.getStatus().name());
        UUID employeeUserId = staff.activeByEmployeeId(task.getEmployeeId())
                .map(StaffCommunicationDirectory.StaffMember::userId)
                .orElseThrow(() -> new BusinessException("WORK_TASK_EMPLOYEE_LOGIN_REQUIRED",
                        "The assigned Employee login is no longer active", HttpStatus.CONFLICT));
        events.publishEvent(new WorkInsightEvents.ReworkAssigned(teamLeadUserId, employeeUserId,
                "Your worksheet ‘" + task.getTitle() + "’ was returned by " + record.getReworkRequestedByRole()
                        + ". Team Lead rework guidance: " + guidance.trim() + ". Open Work Board to update and resubmit it."));
        audit.record("WORK_INSIGHT_REWORK_ASSIGNED", "WORK_TASK_AUDIT", record.getId().toString(),
                "{\"workTaskId\":\"" + task.getId() + "\",\"cycle\":" + record.getReworkCycle() + "}");
        return liveInsight(task, record);
    }

    @Transactional
    public Insight decide(UUID ceoUserId, UUID recordId, boolean approved, String remarks) {
        requireRole(ceoUserId, CEO, "Only the CEO can decide a work audit");
        WorkTaskAuditRecord record = audits.findById(recordId).orElseThrow(() -> new BusinessException(
                "WORK_INSIGHT_NOT_FOUND", "The weekly work audit was not found", HttpStatus.NOT_FOUND));
        record.decide(ceoUserId, approved, remarks);
        if (!approved) {
            DepartmentWorkTask task = requireFinalTask(record.getWorkTaskId());
            task.requestInsightRework("CEO", remarks);
            record.syncTaskStatus(task.getStatus().name());
            events.publishEvent(new WorkInsightEvents.ReworkRequested(ceoUserId, record.getTeamLeadUserId(),
                    "CEO returned worksheet ‘" + record.getTaskTitle() + "’ for rework. Flaws noted: "
                            + remarks.trim() + ". Open Work Board and send corrective guidance to the employee."));
        }
        events.publishEvent(new WorkInsightEvents.CeoDecisionRecorded(ceoUserId, record.getHrAuditedByUserId(),
                "CEO " + (approved ? "approved" : "returned for rework") + " the weekly work audit for ‘"
                        + record.getTaskTitle() + "’ assigned to " + record.getEmployeeName()
                        + (approved ? "." : ". Reason: " + remarks.trim())));
        audit.record(approved ? "WORK_INSIGHT_CEO_APPROVED" : "WORK_INSIGHT_CEO_REWORK_REQUESTED",
                "WORK_TASK_AUDIT", record.getId().toString(), "{\"workTaskId\":\""
                        + record.getWorkTaskId() + "\"}");
        return retainedInsight(record);
    }

    private Insight liveInsight(DepartmentWorkTask task, WorkTaskAuditRecord record) {
        EmployeeDirectory.EmployeeSummary employee = employees.employeeSummary(task.getEmployeeId());
        String teamLeadName = staff.findByUserId(task.getTeamLeadUserId())
                .map(StaffCommunicationDirectory.StaffMember::fullName).orElse("Former Team Lead");
        return new Insight(record == null ? null : record.getId(), task.getId(), weekStart(task.getCreatedAt()),
                task.getDepartmentId(), task.getDepartmentBranch(), task.getEmployeeId(), employee.employeeNumber(),
                employee.displayName(), task.getTeamLeadUserId(), teamLeadName, task.getTitle(),
                task.getStatus().name(), record == null ? "NOT_AUDITED" : record.getAuditStatus().name(),
                record == null ? null : record.getHrAuditedAt(), record == null ? null : record.getCeoDecidedAt(),
                record == null ? null : record.getCeoRemarks(), record == null ? null : record.getReworkRequestedByRole(),
                record == null ? null : record.getReworkReason(), record == null ? null : record.getReworkRequestedAt(),
                record == null ? null : record.getTeamLeadReworkGuidance(), record == null ? null : record.getTeamLeadRespondedAt(),
                record == null ? 0 : record.getReworkCycle());
    }

    private Insight retainedInsight(WorkTaskAuditRecord record) {
        return new Insight(record.getId(), record.getWorkTaskId(), record.getWeekStart(), record.getDepartmentId(),
                record.getDepartmentName(), record.getEmployeeId(), record.getEmployeeNumber(),
                record.getEmployeeName(), record.getTeamLeadUserId(), record.getTeamLeadName(),
                record.getTaskTitle(), record.getTaskStatus(), record.getAuditStatus().name(),
                record.getHrAuditedAt(), record.getCeoDecidedAt(), record.getCeoRemarks(),
                record.getReworkRequestedByRole(), record.getReworkReason(), record.getReworkRequestedAt(),
                record.getTeamLeadReworkGuidance(), record.getTeamLeadRespondedAt(), record.getReworkCycle());
    }

    private DepartmentWorkTask requireFinalTask(UUID workTaskId) {
        DepartmentWorkTask task = tasks.findById(workTaskId).orElseThrow(() -> new BusinessException(
                "WORK_TASK_NOT_FOUND", "The worksheet was not found", HttpStatus.NOT_FOUND));
        if (task.getStatus() != WorkTaskStatus.APPROVED && task.getStatus() != WorkTaskStatus.ACKNOWLEDGED) {
            throw new BusinessException("WORK_INSIGHT_TASK_NOT_FINAL",
                    "Insights can return work only after Team Lead approval", HttpStatus.CONFLICT);
        }
        return task;
    }

    private EmployeeDirectory.EmployeeSummary employee(DepartmentWorkTask task) {
        return employees.employeeSummary(task.getEmployeeId());
    }

    private WorkTaskAuditRecord newRecord(DepartmentWorkTask task, UUID hrUserId) {
        EmployeeDirectory.EmployeeSummary employee = employee(task);
        String teamLeadName = staff.findByUserId(task.getTeamLeadUserId())
                .map(StaffCommunicationDirectory.StaffMember::fullName).orElse("Former Team Lead");
        return new WorkTaskAuditRecord(task.getId(), weekStart(task.getCreatedAt()), task.getDepartmentId(),
                task.getDepartmentBranch(), task.getEmployeeId(), employee.employeeNumber(), employee.displayName(),
                task.getTeamLeadUserId(), teamLeadName, task.getTitle(), task.getStatus().name(), hrUserId);
    }

    private void requireRole(UUID userId, String role, String message) {
        if (CEO.equals(role)) {
            if (!staff.requireChiefExecutive().userId().equals(userId)) {
                throw new BusinessException("WORK_INSIGHT_ROLE_REQUIRED", message, HttpStatus.FORBIDDEN);
            }
            return;
        }
        if (!staff.requireActive(userId).roles().contains(role)) {
            throw new BusinessException("WORK_INSIGHT_ROLE_REQUIRED", message, HttpStatus.FORBIDDEN);
        }
    }

    private LocalDate normalizeWeek(LocalDate value) {
        LocalDate date = value == null ? LocalDate.now(officeZone) : value;
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private LocalDate weekStart(Instant value) {
        return value.atZone(officeZone).toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    public record Insight(UUID auditRecordId, UUID workTaskId, LocalDate weekStart, UUID departmentId,
                          String departmentName, UUID employeeId, String employeeNumber, String employeeName,
                          UUID teamLeadUserId, String teamLeadName, String taskTitle, String taskStatus,
                          String auditStatus, Instant hrAuditedAt, Instant ceoDecidedAt, String ceoRemarks,
                          String reworkRequestedByRole, String reworkReason, Instant reworkRequestedAt,
                          String teamLeadReworkGuidance, Instant teamLeadRespondedAt, int reworkCycle) {}
}
