package com.brainserve.appointment.audit.infrastructure;

import com.brainserve.appointment.audit.domain.AuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {
    Page<AuditEvent> findByEventTypeContainingIgnoreCase(String eventType, Pageable pageable);

    @Query("""
            select e from AuditEvent e
             where (:from is null or e.occurredAt >= :from)
               and (:to is null or e.occurredAt < :to)
               and (:outcome is null or upper(e.outcome) = upper(:outcome))
               and (:query is null or lower(e.eventType) like lower(concat('%', :query, '%'))
                    or lower(e.actorId) like lower(concat('%', :query, '%'))
                    or lower(e.targetType) like lower(concat('%', :query, '%'))
                    or lower(e.targetId) like lower(concat('%', :query, '%')))
               and (:cursorTime is null or e.occurredAt < :cursorTime
                    or (e.occurredAt = :cursorTime and e.id < :cursorId))
             order by e.occurredAt desc, e.id desc
            """)
    List<AuditEvent> findCursor(Instant from, Instant to, String outcome, String query,
                                Instant cursorTime, UUID cursorId, Pageable pageable);

    @Query("""
            select count(e) from AuditEvent e
             where (:from is null or e.occurredAt >= :from)
               and (:to is null or e.occurredAt < :to)
               and (:outcome is null or upper(e.outcome) = upper(:outcome))
               and (:query is null or lower(e.eventType) like lower(concat('%', :query, '%'))
                    or lower(e.actorId) like lower(concat('%', :query, '%'))
                    or lower(e.targetType) like lower(concat('%', :query, '%'))
                    or lower(e.targetId) like lower(concat('%', :query, '%')))
            """)
    long countFiltered(Instant from, Instant to, String outcome, String query);
}
