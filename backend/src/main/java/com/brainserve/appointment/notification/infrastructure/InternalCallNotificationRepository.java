package com.brainserve.appointment.notification.infrastructure;

import com.brainserve.appointment.notification.domain.InternalCallNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;

public interface InternalCallNotificationRepository extends JpaRepository<InternalCallNotification, UUID> {
    List<InternalCallNotification> findTop100ByRecipientUserIdAndDeliveryStatusOrderBySentAtDesc(
            UUID recipientUserId, InternalCallNotification.DeliveryStatus deliveryStatus);
    List<InternalCallNotification> findTop100BySenderUserIdOrderBySentAtDesc(UUID senderUserId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select notification
              from InternalCallNotification notification
             where notification.deliveryStatus in :statuses
               and (notification.nextDeliveryAttemptAt is null
                    or notification.nextDeliveryAttemptAt <= :now)
               and notification.deletedAt is null
             order by notification.sentAt
            """)
    List<InternalCallNotification> lockReadyForDelivery(
            @Param("statuses") java.util.Set<InternalCallNotification.DeliveryStatus> statuses,
            @Param("now") Instant now,
            org.springframework.data.domain.Pageable pageable);
    Optional<InternalCallNotification> findByIdAndRecipientUserIdAndDeliveryStatus(
            UUID id, UUID recipientUserId, InternalCallNotification.DeliveryStatus deliveryStatus);
    long countByRecipientUserIdAndDeliveryStatusAndReadAtIsNull(
            UUID recipientUserId, InternalCallNotification.DeliveryStatus deliveryStatus);

    @Query("select n from InternalCallNotification n where n.recipientUserId=:userId and n.deliveryStatus=:status and n.sentAt>=:from and n.sentAt<:to and n.deletedAt is null order by n.sentAt desc")
    List<InternalCallNotification> findInboxForDay(@Param("userId") UUID userId,
        @Param("status") InternalCallNotification.DeliveryStatus status,
        @Param("from") Instant from, @Param("to") Instant to);

    @Query("select n from InternalCallNotification n where n.senderUserId=:userId and n.sentAt>=:from and n.sentAt<:to and n.deletedAt is null order by n.sentAt desc")
    List<InternalCallNotification> findSentForDay(@Param("userId") UUID userId,
        @Param("from") Instant from, @Param("to") Instant to);

    @Query("select n from InternalCallNotification n where (n.senderUserId=:userId or n.recipientUserId=:userId) and n.sentAt<:before and n.deletedAt is null order by n.sentAt desc")
    List<InternalCallNotification> findArchive(@Param("userId") UUID userId,
        @Param("before") Instant before, org.springframework.data.domain.Pageable pageable);

    Optional<InternalCallNotification> findByIdAndDeletedAtIsNull(UUID id);

    @Query("select count(n) from InternalCallNotification n where n.recipientUserId=:userId and n.deliveryStatus=:status and n.readAt is null and n.deletedAt is null and n.sentAt>=:from and n.sentAt<:to")
    long countTodayUnread(@Param("userId") UUID userId,
        @Param("status") InternalCallNotification.DeliveryStatus status,
        @Param("from") Instant from, @Param("to") Instant to);
}
