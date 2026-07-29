package com.brainserve.appointment.compensation.api;

import com.brainserve.appointment.compensation.application.CompensationService;
import com.brainserve.appointment.compensation.domain.CompensationPackage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/employees/{employeeId}/compensation")
public class CompensationController {
    private final CompensationService service;
    public CompensationController(CompensationService service) { this.service = service; }

    @PostMapping
    @PreAuthorize("hasAuthority('SALARY_WRITE')")
    CompensationResponse create(@PathVariable UUID employeeId, @Valid @RequestBody CompensationRequest request) {
        return CompensationResponse.from(service.create(employeeId, request.components().toDomain(), request.currency(), request.effectiveFrom(), request.effectiveTo()));
    }

    @GetMapping("/current")
    @PreAuthorize("hasAuthority('SALARY_READ')")
    CompensationResponse current(@PathVariable UUID employeeId) { return CompensationResponse.from(service.current(employeeId)); }

    @GetMapping("/history")
    @PreAuthorize("hasAuthority('SALARY_READ')")
    List<CompensationResponse> history(@PathVariable UUID employeeId) { return service.history(employeeId).stream().map(CompensationResponse::from).toList(); }

    public record CompensationRequest(@NotNull @Valid ComponentsRequest components,
                                      @NotBlank @Pattern(regexp = "[A-Z]{3}") String currency,
                                      @NotNull LocalDate effectiveFrom, LocalDate effectiveTo) {}
    public record ComponentsRequest(@Money BigDecimal basicSalary, @Money BigDecimal hra, @Money BigDecimal transportAllowance,
                                    @Money BigDecimal medicalAllowance, @Money BigDecimal specialAllowance, @Money BigDecimal otherAllowance,
                                    @Money BigDecimal providentFundDeduction, @Money BigDecimal professionalTax,
                                    @Money BigDecimal incomeTaxEstimate, @Money BigDecimal otherDeductions) {
        CompensationPackage.Components toDomain() { return new CompensationPackage.Components(basicSalary, hra, transportAllowance,
                medicalAllowance, specialAllowance, otherAllowance, providentFundDeduction, professionalTax, incomeTaxEstimate, otherDeductions); }
    }
    public record CompensationResponse(UUID id, UUID employeeId, BigDecimal basicSalary, BigDecimal hra,
                                       BigDecimal grossSalary, BigDecimal totalDeductions, BigDecimal netSalary,
                                       BigDecimal annualCtc, String currency, LocalDate effectiveFrom, LocalDate effectiveTo, long version) {
        static CompensationResponse from(CompensationPackage value) { return new CompensationResponse(value.getId(), value.getEmployeeId(),
                value.getBasicSalary(), value.getHra(), value.getGrossSalary(), value.getTotalDeductions(), value.getNetSalary(),
                value.getAnnualCtc(), value.getCurrency(), value.getEffectiveFrom(), value.getEffectiveTo(), value.getVersion()); }
    }

    @java.lang.annotation.Documented
    @jakarta.validation.Constraint(validatedBy = {})
    @NotNull
    @java.lang.annotation.Target({java.lang.annotation.ElementType.FIELD, java.lang.annotation.ElementType.PARAMETER,
            java.lang.annotation.ElementType.RECORD_COMPONENT, java.lang.annotation.ElementType.ANNOTATION_TYPE})
    @java.lang.annotation.Retention(java.lang.annotation.RetentionPolicy.RUNTIME)
    @DecimalMin("0.00") @Digits(integer = 16, fraction = 2)
    public @interface Money {
        String message() default "must be a non-negative monetary amount with at most two decimals";
        Class<?>[] groups() default {};
        Class<? extends jakarta.validation.Payload>[] payload() default {};
    }
}
