package com.brainserve.appointment.iam.infrastructure;

import com.brainserve.appointment.iam.domain.UserAccount;
import com.brainserve.appointment.iam.domain.AccountStatus;
import com.brainserve.appointment.iam.domain.SystemRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

import java.util.Optional;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {
    Optional<UserAccount> findByEmailIgnoreCase(String email);
    Optional<UserAccount> findByEmployeeId(UUID employeeId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from UserAccount user where user.id = :id")
    Optional<UserAccount> findByIdForUpdate(@Param("id") UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from UserAccount user where user.employeeId = :employeeId")
    Optional<UserAccount> findByEmployeeIdForUpdate(@Param("employeeId") UUID employeeId);
    List<UserAccount> findAllByFullNameIgnoreCase(String fullName);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCaseAndIdNot(String email, UUID id);
    boolean existsByRolesContaining(SystemRole role);
    List<UserAccount> findAllByStatusOrderByCreatedAtAsc(AccountStatus status);
    List<UserAccount> findDistinctByRolesContainingAndStatusAndEnabledTrueAndArchivedFalse(
            SystemRole role, AccountStatus status);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select distinct user
              from UserAccount user
              join user.roles role
             where role = :role
               and user.status in :statuses
               and user.archived = false
             order by user.createdAt, user.id
            """)
    List<UserAccount> findGoverningRoleAccountsForUpdate(@Param("role") SystemRole role,
                                                         @Param("statuses") Set<AccountStatus> statuses);

    @Query("""
            select user
              from UserAccount user
             where user.status = :status
               and user.enabled = true
               and user.archived = false
               and (:query is null
                    or lower(user.fullName) like lower(concat('%', :query, '%'))
                    or lower(user.email) like lower(concat('%', :query, '%')))
               and (:role is null or :role member of user.roles)
               and (:departmentId is null or exists (
                    select employee.id
                      from Employee employee
                     where employee.id = user.employeeId
                       and employee.departmentId = :departmentId))
            """)
    Page<UserAccount> findOperationalAccounts(@Param("status") AccountStatus status,
                                              @Param("query") String query,
                                              @Param("role") SystemRole role,
                                              @Param("departmentId") UUID departmentId,
                                              Pageable pageable);

    @Query(value = """
            select distinct user
              from UserAccount user
              join user.roles role
             where user.archived = false
               and user.employeeId is not null
               and ((user.status = :activeStatus
                     and user.enabled = true
                     and role in :operationalRoles)
                    or (:includeFormerCeo = true
                        and role = :ceoRole
                        and user.status in :formerCeoStatuses))
               and (:query is null
                    or lower(user.fullName) like lower(concat('%', :query, '%'))
                    or lower(user.email) like lower(concat('%', :query, '%')))
            """,
            countQuery = """
            select count(distinct user.id)
              from UserAccount user
              join user.roles role
             where user.archived = false
               and user.employeeId is not null
               and ((user.status = :activeStatus
                     and user.enabled = true
                     and role in :operationalRoles)
                    or (:includeFormerCeo = true
                        and role = :ceoRole
                        and user.status in :formerCeoStatuses))
               and (:query is null
                    or lower(user.fullName) like lower(concat('%', :query, '%'))
                    or lower(user.email) like lower(concat('%', :query, '%')))
            """)
    Page<UserAccount> findOperationalRoleTransitionCandidates(
            @Param("activeStatus") AccountStatus activeStatus,
            @Param("query") String query,
            @Param("operationalRoles") Set<SystemRole> operationalRoles,
            @Param("includeFormerCeo") boolean includeFormerCeo,
            @Param("ceoRole") SystemRole ceoRole,
            @Param("formerCeoStatuses") Set<AccountStatus> formerCeoStatuses,
            Pageable pageable);

    @Query(value = """
            select account.*
              from iam_user_account account
             where account.archived = false
               and (:query is null
                    or lower(account.full_name) like lower(concat('%', cast(:query as text), '%'))
                    or lower(account.email) like lower(concat('%', cast(:query as text), '%')))
               and exists (
                    select 1 from iam_user_role role
                     where role.user_id = account.id
                       and role.role_name in ('ROLE_EMPLOYEE','ROLE_TEAM_LEAD','ROLE_RECEPTIONIST','ROLE_SECURITY'))
               and not exists (
                    select 1 from iam_user_role role
                     where role.user_id = account.id
                       and role.role_name not in ('ROLE_EMPLOYEE','ROLE_TEAM_LEAD','ROLE_RECEPTIONIST','ROLE_SECURITY'))
               and ((account.employee_id is not null and exists (
                    select 1 from employee employee
                     where employee.id = account.employee_id
                       and employee.department_id = :departmentId))
                    or (account.employee_id is null and account.created_by_user_id = :actorId))
             order by lower(account.email), account.id
            """,
            countQuery = """
            select count(*)
              from iam_user_account account
             where account.archived = false
               and (:query is null
                    or lower(account.full_name) like lower(concat('%', cast(:query as text), '%'))
                    or lower(account.email) like lower(concat('%', cast(:query as text), '%')))
               and exists (
                    select 1 from iam_user_role role
                     where role.user_id = account.id
                       and role.role_name in ('ROLE_EMPLOYEE','ROLE_TEAM_LEAD','ROLE_RECEPTIONIST','ROLE_SECURITY'))
               and not exists (
                    select 1 from iam_user_role role
                     where role.user_id = account.id
                       and role.role_name not in ('ROLE_EMPLOYEE','ROLE_TEAM_LEAD','ROLE_RECEPTIONIST','ROLE_SECURITY'))
               and ((account.employee_id is not null and exists (
                    select 1 from employee employee
                     where employee.id = account.employee_id
                       and employee.department_id = :departmentId))
                    or (account.employee_id is null and account.created_by_user_id = :actorId))
            """,
            nativeQuery = true)
    Page<UserAccount> findHrManagedAccounts(@Param("actorId") UUID actorId,
                                            @Param("departmentId") UUID departmentId,
                                            @Param("query") String query,
                                            Pageable pageable);
}
