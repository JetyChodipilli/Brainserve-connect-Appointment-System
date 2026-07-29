package com.brainserve.appointment.compensation.application;

import com.brainserve.appointment.audit.api.AuditService;
import com.brainserve.appointment.compensation.domain.CompensationPackage;
import com.brainserve.appointment.compensation.infrastructure.CompensationRepository;
import com.brainserve.appointment.employee.api.EmployeeDirectory;
import com.brainserve.appointment.shared.application.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class CompensationService {
    private final CompensationRepository compensation;
    private final EmployeeDirectory employees;
    private final AuditService audit;
    public CompensationService(CompensationRepository compensation, EmployeeDirectory employees, AuditService audit) {
        this.compensation = compensation; this.employees = employees; this.audit = audit;
    }

    @Transactional
    public CompensationPackage create(UUID employeeId, CompensationPackage.Components components, String currency,
                                      LocalDate effectiveFrom, LocalDate effectiveTo) {
        employees.requireEmployee(employeeId);
        if (effectiveTo != null && effectiveTo.isBefore(effectiveFrom)) throw new BusinessException("INVALID_SALARY_PERIOD", "Effective-to must not precede effective-from", HttpStatus.UNPROCESSABLE_ENTITY);
        if (compensation.overlaps(employeeId, effectiveFrom, effectiveTo)) throw new BusinessException("SALARY_PERIOD_OVERLAP", "Compensation period overlaps an existing record", HttpStatus.CONFLICT);
        CompensationPackage saved = compensation.save(new CompensationPackage(employeeId, components, currency, effectiveFrom, effectiveTo));
        audit.record("SALARY_WRITE", "EMPLOYEE", employeeId.toString(), "{\"action\":\"created\"}");
        return saved;
    }

    @Transactional(readOnly = true)
    public CompensationPackage current(UUID employeeId) {
        CompensationPackage value = compensation.findCurrent(employeeId, LocalDate.now()).stream().findFirst()
                .orElseThrow(() -> new BusinessException("COMPENSATION_NOT_FOUND", "Current compensation was not found", HttpStatus.NOT_FOUND));
        audit.record("SALARY_READ", "EMPLOYEE", employeeId.toString(), "{\"scope\":\"current\"}");
        return value;
    }

    @Transactional(readOnly = true)
    public List<CompensationPackage> history(UUID employeeId) {
        List<CompensationPackage> values = compensation.findByEmployeeIdOrderByEffectiveFromDesc(employeeId);
        audit.record("SALARY_READ", "EMPLOYEE", employeeId.toString(), "{\"scope\":\"history\"}");
        return values;
    }
}
