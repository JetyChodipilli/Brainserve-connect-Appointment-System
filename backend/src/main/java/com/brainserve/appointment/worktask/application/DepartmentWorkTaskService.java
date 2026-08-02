package com.brainserve.appointment.worktask.application;

import com.brainserve.appointment.audit.api.AuditService;
import com.brainserve.appointment.employee.api.EmployeeDirectory;
import com.brainserve.appointment.iam.api.StaffCommunicationDirectory;
import com.brainserve.appointment.organization.api.OrganizationDirectory;
import com.brainserve.appointment.shared.application.BusinessException;
import com.brainserve.appointment.teamlead.api.TeamLeadDirectory;
import com.brainserve.appointment.departmenthr.api.DepartmentHrDirectory;
import com.brainserve.appointment.worktask.api.WorkTaskDirectory;
import com.brainserve.appointment.worktask.api.WorkTaskEvents;
import com.brainserve.appointment.worktask.domain.DepartmentWorkTask;
import com.brainserve.appointment.worktask.infrastructure.DepartmentWorkTaskRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class DepartmentWorkTaskService implements WorkTaskDirectory {
    private static final String HR = "ROLE_HR_ADMIN";
    private static final String TEAM_LEAD = "ROLE_TEAM_LEAD";
    private static final String EMPLOYEE = "ROLE_EMPLOYEE";
    private final DepartmentWorkTaskRepository tasks;
    private final EmployeeDirectory employees;
    private final TeamLeadDirectory teamLeads;
    private final OrganizationDirectory organization;
    private final StaffCommunicationDirectory staff;
    private final ApplicationEventPublisher events;
    private final AuditService audit;
    private final DepartmentHrDirectory departmentHrs;

    public DepartmentWorkTaskService(DepartmentWorkTaskRepository tasks, EmployeeDirectory employees,
                                     TeamLeadDirectory teamLeads, OrganizationDirectory organization,
                                     StaffCommunicationDirectory staff,
                                     ApplicationEventPublisher events, AuditService audit,
                                     DepartmentHrDirectory departmentHrs) {
        this.tasks = tasks; this.employees = employees; this.teamLeads = teamLeads;
        this.organization = organization; this.staff = staff;
        this.events = events; this.audit = audit;
        this.departmentHrs = departmentHrs;
    }

    @Transactional
    public DepartmentWorkTask create(UUID teamLeadUserId, CreateCommand command) {
        TeamLeadDirectory.Assignment lead = teamLeads.requireForUser(teamLeadUserId);
        OrganizationDirectory.ActiveDepartment department = organization.requireActiveDepartment(lead.departmentId());
        employees.requireActiveEmployee(command.employeeId());
        if (!employees.departmentIdForEmployee(command.employeeId()).equals(lead.departmentId())) {
            throw new BusinessException("WORK_TASK_DEPARTMENT_MISMATCH",
                    "A Team Lead can assign work only within their department", HttpStatus.FORBIDDEN);
        }
        if (lead.teamLeadEmployeeId().equals(command.employeeId())) {
            throw new BusinessException("WORK_TASK_SELF_ASSIGNMENT_NOT_ALLOWED",
                    "Assign the task to an employee in your department", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        var recipient = staff.activeByEmployeeId(command.employeeId())
                .filter(member -> member.roles().contains(EMPLOYEE))
                .orElseThrow(() -> new BusinessException("WORK_TASK_EMPLOYEE_LOGIN_REQUIRED",
                        "The selected employee must have an active Employee login", HttpStatus.UNPROCESSABLE_ENTITY));
        DepartmentWorkTask created = tasks.saveAndFlush(new DepartmentWorkTask(lead.departmentId(),
                command.employeeId(), teamLeadUserId, command.title(), command.description(), department.name(),
                command.dueDate()));
        events.publishEvent(new WorkTaskEvents.DirectNotificationRequested(teamLeadUserId, recipient.userId(),
                "New " + department.name() + " task sheet assigned: " + command.title() + ". Due "
                        + command.dueDate() + ". Open Work Board to review and start it."));
        audit(created, "ASSIGNED");
        return created;
    }

    @Transactional(readOnly = true)
    public List<DepartmentWorkTask> list(UUID userId, UUID employeeId) {
        Set<String> roles = staff.requireActive(userId).roles();
        if (roles.contains(HR)) return tasks.findTop500ByDepartmentIdOrderByCreatedAtDesc(
                departmentHrs.requireForUser(userId).departmentId());
        if (roles.contains(TEAM_LEAD)) {
            return tasks.findTop500ByDepartmentIdOrderByCreatedAtDesc(teamLeads.requireForUser(userId).departmentId());
        }
        if (roles.contains(EMPLOYEE) && employeeId != null) {
            return tasks.findTop200ByEmployeeIdOrderByCreatedAtDesc(employeeId);
        }
        throw new BusinessException("WORK_TASK_ROLE_REQUIRED",
                "Only Employees, Team Leads and HR can view department work", HttpStatus.FORBIDDEN);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TaskSnapshot> recentForDepartment(UUID departmentId) {
        return tasks.findTop500ByDepartmentIdOrderByCreatedAtDesc(departmentId)
                .stream()
                .map(this::snapshot)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public TaskSnapshot requireTask(UUID workTaskId) {
        return snapshot(require(workTaskId));
    }

    @Override
    @Transactional
    public TaskSnapshot requestInsightRework(
            UUID workTaskId,
            String reviewerRole,
            String reason
    ) {
        DepartmentWorkTask task = require(workTaskId);
        task.requestInsightRework(reviewerRole, reason);
        return snapshot(task);
    }

    @Override
    @Transactional
    public TaskSnapshot assignInsightRework(
            UUID workTaskId,
            String guidance
    ) {
        DepartmentWorkTask task = require(workTaskId);
        task.assignInsightRework(guidance);
        return snapshot(task);
    }

    @Transactional
    public DepartmentWorkTask start(UUID userId, UUID employeeId, UUID taskId, String update) {
        DepartmentWorkTask task = requireProgressScope(userId, employeeId, taskId);
        task.start(update);
        notifyCounterpart(userId, employeeId, task, "started", update);
        audit(task, "IN_PROGRESS");
        return task;
    }

    @Transactional
    public DepartmentWorkTask complete(UUID userId, UUID employeeId, UUID taskId, String update) {
        DepartmentWorkTask task = requireProgressScope(userId, employeeId, taskId);
        task.complete(update);
        notifyCounterpart(userId, employeeId, task, "marked completed and is waiting for Team Lead approval", update);
        audit(task, "COMPLETED");
        return task;
    }

    @Transactional
    public DepartmentWorkTask approve(UUID teamLeadUserId, UUID taskId, String review) {
        DepartmentWorkTask task = requireTeamLeadScope(teamLeadUserId, taskId);
        task.approve(review);
        UUID employeeUserId = employeeUserId(task);
        events.publishEvent(new WorkTaskEvents.DirectNotificationRequested(teamLeadUserId, employeeUserId,
                "Your completed task ‘" + task.getTitle() + "’ was approved by your Team Lead. Open Work Board to acknowledge the decision."));
        events.publishEvent(new WorkTaskEvents.HrPerformanceNotificationRequested(teamLeadUserId, task.getDepartmentId(),
                "Team Lead completed review and approved ‘" + task.getTitle() + "’ in department branch "
                        + task.getDepartmentBranch() + " for department " + task.getDepartmentId() + "."));
        audit(task, "APPROVED");
        return task;
    }

    @Transactional
    public DepartmentWorkTask requestChanges(UUID teamLeadUserId, UUID taskId, String review) {
        DepartmentWorkTask task = requireTeamLeadScope(teamLeadUserId, taskId);
        task.requestChanges(review);
        events.publishEvent(new WorkTaskEvents.DirectNotificationRequested(teamLeadUserId, employeeUserId(task),
                "Changes were requested for ‘" + task.getTitle() + "’: " + review.trim()));
        audit(task, "CHANGES_REQUESTED");
        return task;
    }

    @Transactional
    public DepartmentWorkTask acknowledge(UUID employeeUserId, UUID employeeId, UUID taskId) {
        DepartmentWorkTask task = requireEmployeeScope(employeeId, taskId);
        task.acknowledge();
        events.publishEvent(new WorkTaskEvents.DirectNotificationRequested(employeeUserId, task.getTeamLeadUserId(),
                "Employee acknowledged Team Lead approval for ‘" + task.getTitle() + "’."));
        audit(task, "ACKNOWLEDGED");
        return task;
    }

    @Transactional(readOnly = true)
    public List<Performance> performance(UUID hrUserId) {
        UUID departmentId = departmentHrs.requireForUser(hrUserId).departmentId();
        return tasks.performance().stream().filter(value -> value.getDepartmentId().equals(departmentId))
                .map(value -> new Performance(value.getTeamLeadUserId(),
                        value.getDepartmentId(), value.getTotalTasks(), value.getCompletedTasks(),
                        value.getApprovedTasks(), value.getInProgressTasks(), value.getPendingReviewTasks(),
                        value.getOverdueTasks(), value.getTotalTasks() == 0 ? 0
                        : Math.round(value.getApprovedTasks() * 100.0 / value.getTotalTasks()),
                        value.getLastApprovedAt())).toList();
    }

    private DepartmentWorkTask requireProgressScope(UUID userId, UUID employeeId, UUID taskId) {
        var member = staff.requireActive(userId);
        if (member.roles().contains(TEAM_LEAD)) return requireTeamLeadScope(userId, taskId);
        if (member.roles().contains(EMPLOYEE) && employeeId != null) return requireEmployeeScope(employeeId, taskId);
        throw new BusinessException("WORK_TASK_PROGRESS_DENIED", "You cannot update this task",
                HttpStatus.FORBIDDEN);
    }

    private DepartmentWorkTask requireTeamLeadScope(UUID teamLeadUserId, UUID taskId) {
        DepartmentWorkTask task = require(taskId);
        TeamLeadDirectory.Assignment lead = teamLeads.requireForUser(teamLeadUserId);
        if (!task.getDepartmentId().equals(lead.departmentId())
                || !task.getTeamLeadUserId().equals(teamLeadUserId)) {
            throw new BusinessException("WORK_TASK_TEAM_LEAD_SCOPE_DENIED",
                    "This task belongs to another Team Lead or department", HttpStatus.FORBIDDEN);
        }
        return task;
    }

    private DepartmentWorkTask requireEmployeeScope(UUID employeeId, UUID taskId) {
        DepartmentWorkTask task = require(taskId);
        if (!task.getEmployeeId().equals(employeeId)) throw new BusinessException(
                "WORK_TASK_EMPLOYEE_SCOPE_DENIED", "This task is assigned to another employee", HttpStatus.FORBIDDEN);
        return task;
    }

    private DepartmentWorkTask require(UUID taskId) {
        return tasks.findById(taskId).orElseThrow(() -> new BusinessException("WORK_TASK_NOT_FOUND",
                "The work task was not found", HttpStatus.NOT_FOUND));
    }

    private UUID employeeUserId(DepartmentWorkTask task) {
        return staff.activeByEmployeeId(task.getEmployeeId()).map(StaffCommunicationDirectory.StaffMember::userId)
                .orElseThrow(() -> new BusinessException("WORK_TASK_EMPLOYEE_LOGIN_REQUIRED",
                        "The assigned Employee login is no longer active", HttpStatus.CONFLICT));
    }

    private TaskSnapshot snapshot(DepartmentWorkTask task) {
        return new TaskSnapshot(
                task.getId(),
                task.getCreatedAt(),
                task.getDepartmentId(),
                task.getDepartmentBranch(),
                task.getEmployeeId(),
                task.getTeamLeadUserId(),
                task.getTitle(),
                task.getStatus().name()
        );
    }

    private void notifyCounterpart(UUID actorUserId, UUID actorEmployeeId, DepartmentWorkTask task,
                                   String action, String update) {
        boolean employeeActor = actorEmployeeId != null && actorEmployeeId.equals(task.getEmployeeId());
        UUID recipient = employeeActor ? task.getTeamLeadUserId() : employeeUserId(task);
        String note = update == null || update.isBlank() ? "" : " Update: " + update.trim();
        events.publishEvent(new WorkTaskEvents.DirectNotificationRequested(actorUserId, recipient,
                "Task ‘" + task.getTitle() + "’ was " + action + "." + note));
    }

    private void audit(DepartmentWorkTask task, String action) {
        audit.record("WORK_TASK_" + action, "WORK_TASK", task.getId().toString(),
                "{\"departmentId\":\"" + task.getDepartmentId() + "\",\"employeeId\":\""
                        + task.getEmployeeId() + "\"}");
    }

    public record CreateCommand(UUID employeeId, String title, String description,
                                LocalDate dueDate) {}
    public record Performance(UUID teamLeadUserId, UUID departmentId, long totalTasks,
                              long completedTasks, long approvedTasks, long inProgressTasks,
                              long pendingReviewTasks, long overdueTasks, long completionRate,
                              Instant lastApprovedAt) {}
}
