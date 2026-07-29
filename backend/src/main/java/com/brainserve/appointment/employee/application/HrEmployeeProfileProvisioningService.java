package com.brainserve.appointment.employee.application;

import com.brainserve.appointment.employee.api.EmployeeEvents;
import com.brainserve.appointment.employee.domain.Employee;
import com.brainserve.appointment.employee.domain.EmployeeStatus;
import com.brainserve.appointment.employee.infrastructure.EmployeeRepository;
import com.brainserve.appointment.iam.api.AppointmentHostDirectory;
import com.brainserve.appointment.iam.domain.UserAccount;
import com.brainserve.appointment.organization.api.OrganizationDirectory;
import com.brainserve.appointment.shared.application.BusinessException;
import jakarta.persistence.EntityManager;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class HrEmployeeProfileProvisioningService {
    private final EmployeeRepository employees;
    private final OrganizationDirectory organization;
    private final AppointmentHostDirectory appointmentHosts;
    private final EntityManager entityManager;
    private final ApplicationEventPublisher events;

    public HrEmployeeProfileProvisioningService(EmployeeRepository employees,
                                                OrganizationDirectory organization,
                                                AppointmentHostDirectory appointmentHosts,
                                                EntityManager entityManager,
                                                ApplicationEventPublisher events) {
        this.employees = employees;
        this.organization = organization;
        this.appointmentHosts = appointmentHosts;
        this.entityManager = entityManager;
        this.events = events;
    }

    @Transactional
    public Employee createAndLink(UserAccount account, UUID departmentId, String phoneNumber,
                                  String designation, LocalDate joiningDate) {
        if (account.getEmployeeId() != null) {
            throw new BusinessException("HR_EMPLOYEE_PROFILE_ALREADY_LINKED",
                    "This privileged account is already linked to an employee profile", HttpStatus.CONFLICT);
        }
        if (employees.existsByOfficialEmailIgnoreCase(account.getEmail())) {
            throw new BusinessException("EMPLOYEE_EMAIL_EXISTS",
                    "An employee profile already uses this account email", HttpStatus.CONFLICT);
        }
        if (joiningDate == null || joiningDate.isAfter(LocalDate.now())) {
            throw new BusinessException("INVALID_JOINING_DATE",
                    "Joining date is required and cannot be in the future", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        String normalizedDesignation = designation == null ? "" : designation.trim();
        if (normalizedDesignation.length() < 2 || normalizedDesignation.length() > 120) {
            throw new BusinessException("INVALID_DESIGNATION",
                    "Designation must contain 2-120 characters", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        String normalizedPhone = phoneNumber == null ? null : phoneNumber.trim();
        if (normalizedPhone != null && normalizedPhone.length() > 30) {
            throw new BusinessException("INVALID_PHONE_NUMBER",
                    "Phone number cannot exceed 30 characters", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        var department = organization.requireActiveDepartment(departmentId);
        String[] names = splitName(account.getFullName());
        long sequence = ((Number) entityManager.createNativeQuery(
                "select nextval('employee_number_seq')").getSingleResult()).longValue();
        Employee employee = employees.saveAndFlush(new Employee(
                "BSPL-" + department.code() + "-" + String.format("%04d", sequence),
                names[0], names[1], account.getEmail(), normalizedPhone, departmentId,
                normalizedDesignation, joiningDate));
        employee.transitionTo(EmployeeStatus.ACTIVE);
        employees.saveAndFlush(employee);
        appointmentHosts.linkEmployee(account.getId(), employee.getId());
        events.publishEvent(new EmployeeEvents.EmployeeCreated(employee.getId(), employee.getEmployeeNumber(),
                employee.getOfficialEmail(), Instant.now()));
        return employee;
    }

    private String[] splitName(String fullName) {
        String normalized = fullName == null ? "" : fullName.trim().replaceAll("\\s+", " ");
        int separator = normalized.indexOf(' ');
        String firstName = separator < 0 ? normalized : normalized.substring(0, separator);
        String lastName = separator < 0 ? "" : normalized.substring(separator + 1);
        if (firstName.length() < 2 || firstName.length() > 80 || lastName.length() > 80) {
            throw new BusinessException("INVALID_HR_EMPLOYEE_NAME",
                    "The account name must fit the employee profile name fields", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        return new String[]{firstName, lastName};
    }
}
