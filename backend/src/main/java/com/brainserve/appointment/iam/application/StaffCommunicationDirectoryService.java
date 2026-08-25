package com.brainserve.appointment.iam.application;

import com.brainserve.appointment.iam.api.StaffCommunicationDirectory;
import com.brainserve.appointment.iam.domain.UserAccount;
import com.brainserve.appointment.iam.infrastructure.UserAccountRepository;
import com.brainserve.appointment.shared.application.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class StaffCommunicationDirectoryService implements StaffCommunicationDirectory {
    private final UserAccountRepository users;

    public StaffCommunicationDirectoryService(UserAccountRepository users) { this.users = users; }

    @Override
    @Transactional(readOnly = true)
    public StaffMember requireActive(UUID userId) {
        UserAccount user = users.findById(userId).filter(UserAccount::isEnabled)
                .orElseThrow(() -> new BusinessException("STAFF_ACCOUNT_NOT_ACTIVE",
                        "The staff account is not active", HttpStatus.UNPROCESSABLE_ENTITY));
        return member(user);
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.Optional<StaffMember> findByUserId(UUID userId) {
        return users.findById(userId).map(this::member);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StaffMember> findByUserIds(Set<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) return List.of();
        return users.findAllById(userIds).stream().map(this::member).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.Optional<StaffMember> activeByEmployeeId(UUID employeeId) {
        return users.findByEmployeeId(employeeId).filter(UserAccount::isEnabled).map(this::member);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StaffMember> activeWithAnyRole(Set<String> roles) {
        java.util.LinkedHashMap<UUID, StaffMember> members = new java.util.LinkedHashMap<>();
        roles.stream().map(role -> {
            try {
                return java.util.Optional.of(com.brainserve.appointment.iam.domain.SystemRole.valueOf(role));
            } catch (IllegalArgumentException ignored) {
                return java.util.Optional.<com.brainserve.appointment.iam.domain.SystemRole>empty();
            }
        }).flatMap(java.util.Optional::stream).forEach(role ->
                users.findDistinctByRolesContainingAndStatusAndEnabledTrueAndArchivedFalse(
                                role, com.brainserve.appointment.iam.domain.AccountStatus.ACTIVE)
                        .forEach(user -> members.putIfAbsent(user.getId(), member(user))));
        return members.values().stream()
                .sorted(java.util.Comparator.comparing(StaffMember::fullName)).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<StaffMember> activeWithAnyRoleInDepartment(Set<String> roles, UUID departmentId, int limit) {
        if (roles == null || roles.isEmpty() || departmentId == null) return List.of();
        int pageSize = Math.max(1, Math.min(limit, 200));
        var pageable = PageRequest.of(0, pageSize, Sort.by(Sort.Direction.ASC, "fullName"));
        java.util.LinkedHashMap<UUID, StaffMember> members = new java.util.LinkedHashMap<>();
        roles.stream().map(role -> {
            try {
                return java.util.Optional.of(com.brainserve.appointment.iam.domain.SystemRole.valueOf(role));
            } catch (IllegalArgumentException ignored) {
                return java.util.Optional.<com.brainserve.appointment.iam.domain.SystemRole>empty();
            }
        }).flatMap(java.util.Optional::stream).forEach(role ->
                users.findOperationalAccounts(
                                com.brainserve.appointment.iam.domain.AccountStatus.ACTIVE,
                                "", role, departmentId, pageable)
                        .forEach(user -> members.putIfAbsent(user.getId(), member(user))));
        return members.values().stream()
                .sorted(java.util.Comparator.comparing(StaffMember::fullName))
                .limit(pageSize)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public StaffMember requireChiefExecutive() {
        List<UserAccount> chiefExecutives =
                users.findDistinctByRolesContainingAndStatusAndEnabledTrueAndArchivedFalse(
                        com.brainserve.appointment.iam.domain.SystemRole.ROLE_CEO,
                        com.brainserve.appointment.iam.domain.AccountStatus.ACTIVE);
        if (chiefExecutives.size() != 1) {
            throw new BusinessException("CEO_GOVERNANCE_CONFLICT",
                    chiefExecutives.isEmpty()
                            ? "No active company CEO is available for this approval route"
                            : "Multiple active CEO accounts require database reconciliation",
                    HttpStatus.CONFLICT);
        }
        return member(chiefExecutives.getFirst());
    }

    private StaffMember member(UserAccount user) {
        return new StaffMember(user.getId(), user.getEmployeeId(), user.getFullName(), user.getEmail(),
                user.getRoles().stream().map(Enum::name).collect(java.util.stream.Collectors.toUnmodifiableSet()));
    }
}
