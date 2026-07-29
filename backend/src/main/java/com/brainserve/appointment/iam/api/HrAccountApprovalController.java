package com.brainserve.appointment.iam.api;

import com.brainserve.appointment.iam.application.AccountProvisioningService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/hr/users", "/api/v1/hr/users"})
@PreAuthorize("hasRole('HR_ADMIN')")
public class HrAccountApprovalController {
    private final AccountProvisioningService service;

    public HrAccountApprovalController(AccountProvisioningService service) {
        this.service = service;
    }

    @GetMapping
    List<SystemAdminAccountController.AccountResponse> pending(@AuthenticationPrincipal Jwt jwt) {
        return service.pendingHrApproval(actorId(jwt)).stream()
                .map(SystemAdminAccountController.AccountResponse::from).toList();
    }

    @PostMapping("/{id}/approve")
    SystemAdminAccountController.AccountResponse approve(@PathVariable UUID id,
                                                          @AuthenticationPrincipal Jwt jwt) {
        return SystemAdminAccountController.AccountResponse.from(service.approveByHr(actorId(jwt), id));
    }

    @PostMapping("/{id}/reject")
    SystemAdminAccountController.AccountResponse reject(
            @PathVariable UUID id, @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody SystemAdminAccountController.RejectAccountRequest request) {
        return SystemAdminAccountController.AccountResponse.from(
                service.rejectByHr(actorId(jwt), id, request.reason()));
    }

    private UUID actorId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
