package com.brainserve.appointment.organization.api;

import com.brainserve.appointment.audit.api.AuditService;
import com.brainserve.appointment.organization.domain.Department;
import com.brainserve.appointment.organization.infrastructure.DepartmentRepository;
import com.brainserve.appointment.shared.application.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/departments")
public class DepartmentController {

    private final DepartmentRepository departments;
    private final AuditService audit;

    public DepartmentController(
            DepartmentRepository departments,
            AuditService audit
    ) {
        this.departments = departments;
        this.audit = audit;
    }

    /**
     * Department directory is required by:
     * - System Admin
     * - CEO
     * - HR Admin
     * - Employees with EMPLOYEE_READ
     * - Team Leads with TEAM_LEAD_DIRECTORY_VIEW
     */
    @GetMapping
    @PreAuthorize("""
            hasAnyAuthority(
                'ROLE_SYSTEM_ADMIN',
                'ROLE_CEO',
                'ROLE_HR_ADMIN',
                'EMPLOYEE_READ',
                'TEAM_LEAD_DIRECTORY_VIEW'
            )
            """)
    public List<DepartmentResponse> list() {
        return departments.findAllByOrderByNameAsc()
                .stream()
                .map(DepartmentResponse::from)
                .toList();
    }

    @PostMapping
    @PreAuthorize("hasAuthority('DEPARTMENT_MANAGE')")
    @Transactional
    public DepartmentResponse create(
            @Valid @RequestBody DepartmentRequest request
    ) {
        if (departments.existsByCodeIgnoreCase(request.code())) {
            throw new BusinessException(
                    "DEPARTMENT_CODE_EXISTS",
                    "Department code already exists",
                    HttpStatus.CONFLICT
            );
        }

        Department created = departments.save(
                new Department(request.code(), request.name())
        );

        audit.record(
                "DEPARTMENT_CREATED",
                "DEPARTMENT",
                created.getId().toString(),
                "{\"code\":\"" + created.getCode() + "\"}"
        );

        return DepartmentResponse.from(created);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('DEPARTMENT_MANAGE')")
    @Transactional
    public DepartmentResponse status(
            @PathVariable UUID id,
            @RequestBody StatusRequest request
    ) {
        Department department = departments.findById(id)
                .orElseThrow(() -> new BusinessException(
                        "DEPARTMENT_NOT_FOUND",
                        "Department was not found",
                        HttpStatus.NOT_FOUND
                ));

        if (!request.active()
                && ("EXEC".equalsIgnoreCase(department.getCode())
                || "HR".equalsIgnoreCase(department.getCode()))) {

            throw new BusinessException(
                    "ROUTING_DEPARTMENT_REQUIRED",
                    "Executive Office and Human Resources must remain active for appointment routing",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        department.changeStatus(request.active());

        audit.record(
                request.active()
                        ? "DEPARTMENT_ACTIVATED"
                        : "DEPARTMENT_DEACTIVATED",
                "DEPARTMENT",
                department.getId().toString(),
                "{\"code\":\"" + department.getCode() + "\"}"
        );

        return DepartmentResponse.from(department);
    }

    public record DepartmentRequest(
            @NotBlank
            @Pattern(regexp = "[A-Za-z0-9_-]{2,20}")
            String code,

            @NotBlank
            @Size(max = 120)
            String name
    ) {
    }

    public record StatusRequest(boolean active) {
    }

    public record DepartmentResponse(
            UUID id,
            String code,
            String name,
            boolean active,
            long version
    ) {
        static DepartmentResponse from(Department value) {
            return new DepartmentResponse(
                    value.getId(),
                    value.getCode(),
                    value.getName(),
                    value.isActive(),
                    value.getVersion()
            );
        }
    }
}