package com.brainserve.appointment.reporting.api;

import com.brainserve.appointment.departmenthr.api.DepartmentHrDirectory;
import com.brainserve.appointment.organization.api.OrganizationDirectory;
import com.brainserve.appointment.teamlead.api.TeamLeadDirectory;
import com.brainserve.appointment.manager.api.ManagerDirectory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/departments")
public class OrganizationScopeController {
    private final OrganizationDirectory organization;
    private final DepartmentHrDirectory departmentHrs;
    private final TeamLeadDirectory teamLeads;
    private final ManagerDirectory managers;

    public OrganizationScopeController(OrganizationDirectory organization, DepartmentHrDirectory departmentHrs,
                                       TeamLeadDirectory teamLeads, ManagerDirectory managers) {
        this.organization = organization; this.departmentHrs = departmentHrs;
        this.teamLeads = teamLeads; this.managers = managers;
    }

    @GetMapping("/visible")
    @PreAuthorize("hasAnyRole('CEO','HR_ADMIN','MANAGER','TEAM_LEAD')")
    List<OrganizationDirectory.DepartmentSummary> visible(@AuthenticationPrincipal Jwt jwt) {
        List<String> authorities = jwt.getClaimAsStringList("authorities");
        if (authorities != null && authorities.contains("ROLE_CEO")) return organization.allDepartments();
        UUID userId = UUID.fromString(jwt.getSubject());
        UUID departmentId;
        if (authorities != null && authorities.contains("ROLE_HR_ADMIN")) {
            departmentId = departmentHrs.requireForUser(userId).departmentId();
        } else if (authorities != null && authorities.contains("ROLE_MANAGER")) {
            departmentId = managers.requireForUser(userId).departmentId();
        } else {
            departmentId = teamLeads.requireForUser(userId).departmentId();
        }
        return organization.findDepartment(departmentId).stream().toList();
    }
}
