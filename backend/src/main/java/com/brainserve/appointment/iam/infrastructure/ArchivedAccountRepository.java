package com.brainserve.appointment.iam.infrastructure;

import com.brainserve.appointment.iam.domain.ArchivedAccount;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ArchivedAccountRepository extends JpaRepository<ArchivedAccount, UUID> {
    Optional<ArchivedAccount> findFirstByOriginalUserIdAndRecoveredAtIsNull(UUID originalUserId);
    List<ArchivedAccount> findTop500ByOrderByArchivedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select account from ArchivedAccount account where account.id = :id")
    Optional<ArchivedAccount> findForUpdateById(@Param("id") UUID id);

    @Query("""
            select account
              from ArchivedAccount account
             where account.recoveredAt is null
               and (:query is null
                    or lower(account.fullNameSnapshot) like lower(concat('%', :query, '%'))
                    or lower(account.emailSnapshot) like lower(concat('%', :query, '%'))
                    or lower(account.roleSnapshot) like lower(concat('%', :query, '%'))
                    or lower(account.departmentNameSnapshot) like lower(concat('%', :query, '%')))
            """)
    Page<ArchivedAccount> search(@Param("query") String query, Pageable pageable);
}
