package com.brainserve.appointment.notification.application;

import com.brainserve.appointment.notification.api.InternalCallEvent;
import com.brainserve.appointment.notification.infrastructure.InternalCallNotificationRepository;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.brainserve.appointment.shared.application.BusinessException;
import org.springframework.http.HttpStatus;

@Component
public class InternalCallNotificationConsumer {
    private final InternalCallNotificationRepository notifications;

    public InternalCallNotificationConsumer(InternalCallNotificationRepository notifications) {
        this.notifications = notifications;
    }

    @KafkaListener(topics = "${brainserve.notification.internal-call-topic}")
    @Transactional
    public void receive(InternalCallEvent event) {
        var notification = notifications.findById(event.notificationId())
                .orElseThrow(() -> new BusinessException("INTERNAL_NOTIFICATION_NOT_COMMITTED",
                        "Notification row is not available for delivery", HttpStatus.CONFLICT));
        if (!notification.getSenderUserId().equals(event.senderUserId())
                || !notification.getRecipientUserId().equals(event.recipientUserId())) {
            throw new BusinessException("INTERNAL_NOTIFICATION_EVENT_MISMATCH",
                    "Notification event identity does not match the durable record", HttpStatus.CONFLICT);
        }
        notification.markDelivered();
    }
}
