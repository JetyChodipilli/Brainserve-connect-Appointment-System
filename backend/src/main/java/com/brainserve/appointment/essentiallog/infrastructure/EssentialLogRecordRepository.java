package com.brainserve.appointment.essentiallog.infrastructure;

import com.brainserve.appointment.essentiallog.domain.EssentialLogRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface EssentialLogRecordRepository extends JpaRepository<EssentialLogRecord, UUID> {
    @Query("""
            select e from EssentialLogRecord e
             where (:from is null or e.occurredAt >= :from)
               and (:to is null or e.occurredAt < :to)
               and (:category is null or upper(e.category) = upper(:category))
               and (:status is null or upper(e.status) = upper(:status))
               and (:query is null or lower(e.title) like lower(concat('%', :query, '%'))
                    or lower(e.detail) like lower(concat('%', :query, '%'))
                    or lower(e.eventType) like lower(concat('%', :query, '%'))
                    or lower(e.subjectType) like lower(concat('%', :query, '%'))
                    or lower(e.subjectId) like lower(concat('%', :query, '%')))
               and (:cursorTime is null or e.occurredAt < :cursorTime
                    or (e.occurredAt = :cursorTime and e.id < :cursorId))
             order by e.occurredAt desc, e.id desc
            """)
    List<EssentialLogRecord> findCursor(Instant from, Instant to, String category, String status, String query,
                                        Instant cursorTime, UUID cursorId, Pageable pageable);

    @Query("""
            select count(e) from EssentialLogRecord e
             where (:from is null or e.occurredAt >= :from)
               and (:to is null or e.occurredAt < :to)
               and (:category is null or upper(e.category) = upper(:category))
               and (:status is null or upper(e.status) = upper(:status))
               and (:query is null or lower(e.title) like lower(concat('%', :query, '%'))
                    or lower(e.detail) like lower(concat('%', :query, '%'))
                    or lower(e.eventType) like lower(concat('%', :query, '%'))
                    or lower(e.subjectType) like lower(concat('%', :query, '%'))
                    or lower(e.subjectId) like lower(concat('%', :query, '%')))
            """)
    long countFiltered(Instant from, Instant to, String category, String status, String query);
}
