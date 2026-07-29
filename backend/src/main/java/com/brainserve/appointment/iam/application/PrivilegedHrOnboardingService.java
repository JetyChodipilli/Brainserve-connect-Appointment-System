package com.brainserve.appointment.iam.application;

import com.brainserve.appointment.audit.api.AuditService;
import com.brainserve.appointment.departmenthr.application.DepartmentHrAssignmentService;
import com.brainserve.appointment.employee.application.HrEmployeeProfileProvisioningService;
import com.brainserve.appointment.iam.domain.AccountStatus;
import com.brainserve.appointment.iam.domain.SystemRole;
import com.brainserve.appointment.iam.domain.UserAccount;
import com.brainserve.appointment.iam.infrastructure.UserAccountRepository;
import com.brainserve.appointment.manager.api.ManagerDirectory;
import com.brainserve.appointment.organization.api.OrganizationDirectory;
import com.brainserve.appointment.shared.application.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
public class PrivilegedHrOnboardingService {
    private final AccountProvisioningService accounts;
    private final UserAccountRepository users;
    private final HrEmployeeProfileProvisioningService hrProfiles;
    private final DepartmentHrAssignmentService departmentHrs;
    private final ManagerDirectory managers;
    private final OrganizationDirectory organization;
    private final AuditService audit;

    public PrivilegedHrOnboardingService(AccountProvisioningService accounts, UserAccountRepository users,
                                         HrEmployeeProfileProvisioningService hrProfiles,
                                         DepartmentHrAssignmentService departmentHrs,
                                         ManagerDirectory managers,
                                         OrganizationDirectory organization, AuditService audit) {
        this.accounts = accounts;
        this.users = users;
        this.hrProfiles = hrProfiles;
        this.departmentHrs = departmentHrs;
        this.managers = managers;
        this.organization = organization;
        this.audit = audit;
    }

    @Transactional
    public UserAccount approveByCeo(UUID actorId, UUID targetId, HrOnboardingCommand command) {
        UserAccount target = requirePending(targetId);
        SystemRole role = requireOnboardedRole(target);
        validate(role, command);
        organization.lockActiveDepartment(command.departmentId());
        requireDepartmentAvailable(role, command.departmentId());
        UserAccount approved = accounts.approveByCeo(actorId, targetId);
        completeOnboarding(actorId, approved, role, command);
        return approved;
    }

    @Transactional
    public UserAccount approveBySystemAdmin(UUID actorId, UUID targetId, HrOnboardingCommand command) {
        UserAccount target = requirePending(targetId);
        if (target.getRoles().equals(java.util.Set.of(SystemRole.ROLE_CEO))) {
            return accounts.approveBySystemAdmin(actorId, targetId);
        }
        throw new BusinessException("CEO_APPROVAL_REQUIRED",
                "HR Admin and Manager accounts must be approved by the single company CEO",
                HttpStatus.FORBIDDEN);
    }

    private void completeOnboarding(UUID actorId, UserAccount approved, SystemRole role,
                                    HrOnboardingCommand command) {
        var employee = hrProfiles.createAndLink(approved, command.departmentId(), command.phoneNumber(),
                command.designation(), command.joiningDate());
        users.saveAndFlush(approved);
        if (role == SystemRole.ROLE_HR_ADMIN) {
            departmentHrs.assign(actorId, command.departmentId(), approved.getId());
        } else {
            managers.assignForOnboarding(actorId, command.departmentId(), approved.getId());
        }
        audit.record(role == SystemRole.ROLE_HR_ADMIN
                        ? "HR_ACCOUNT_ONBOARDING_COMPLETED" : "MANAGER_ACCOUNT_ONBOARDING_COMPLETED",
                "USER_ACCOUNT", approved.getId().toString(),
                "{\"role\":\"" + role + "\",\"departmentId\":\"" + command.departmentId()
                        + "\",\"employeeId\":\"" + employee.getId() + "\"}");
    }

    private UserAccount requirePending(UUID targetId) {
        UserAccount target = users.findById(targetId).orElseThrow(() -> new BusinessException(
                "USER_NOT_FOUND", "User account was not found", HttpStatus.NOT_FOUND));
        if (target.getStatus() != AccountStatus.PENDING_APPROVAL) {
            throw new BusinessException("INVALID_ACCOUNT_STATUS",
                    "The privileged account must be pending approval", HttpStatus.CONFLICT);
        }
        return target;
    }

    private SystemRole requireOnboardedRole(UserAccount target) {
        if (target.getRoles().size() != 1) {
            throw new BusinessException("INVALID_PRIVILEGED_ACCOUNT_ROLE",
                    "The pending account must have exactly one role", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        SystemRole role = target.getRoles().iterator().next();
        if (role != SystemRole.ROLE_HR_ADMIN && role != SystemRole.ROLE_MANAGER) {
            throw new BusinessException("INVALID_PRIVILEGED_ACCOUNT_ROLE",
                    "Only pending HR Admin or Manager accounts use department onboarding",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        return role;
    }

    private void validate(SystemRole role, HrOnboardingCommand command) {
        if (command == null || command.departmentId() == null || command.joiningDate() == null
                || command.designation() == null || command.designation().isBlank()) {
            throw new BusinessException("PRIVILEGED_DEPARTMENT_ASSIGNMENT_REQUIRED",
                    "Select a department, designation and joining date before approving the "
                            + displayName(role),
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
    }

    private void requireDepartmentAvailable(SystemRole role, UUID departmentId) {
        if (role == SystemRole.ROLE_HR_ADMIN && departmentHrs.activeForDepartment(departmentId).isPresent()) {
            throw new BusinessException("DEPARTMENT_HR_ALREADY_ASSIGNED",
                    "The selected department already has an active HR Admin", HttpStatus.CONFLICT);
        }
        if (role == SystemRole.ROLE_MANAGER && managers.activeForDepartment(departmentId).isPresent()) {
            throw new BusinessException("DEPARTMENT_MANAGER_ALREADY_ASSIGNED",
                    "The selected department already has an active Manager", HttpStatus.CONFLICT);
        }
    }

    private String displayName(SystemRole role) {
        return role == SystemRole.ROLE_MANAGER ? "Manager" : "HR Admin";
    }

    public record HrOnboardingCommand(UUID departmentId, String phoneNumber,
                                      String designation, LocalDate joiningDate) {}
}
