package com.brainserve.appointment.iam.infrastructure;

import com.brainserve.appointment.iam.domain.RefreshTokenSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenSessionRepository extends JpaRepository<RefreshTokenSession, UUID> {
    Optional<RefreshTokenSession> findByTokenHash(String tokenHash);
    @Modifying
    @Query("update RefreshTokenSession s set s.revokedAt = :now where s.familyId = :familyId and s.revokedAt is null")
    int revokeFamily(UUID familyId, Instant now);
    @Modifying
    @Query("update RefreshTokenSession s set s.revokedAt = :now where s.userId = :userId and s.revokedAt is null")
    int revokeAllForUser(UUID userId, Instant now);
}
