package com.brainserve.appointment.worktask.api;

import java.util.UUID;

public final class WorkTaskEvents {
    private WorkTaskEvents() {}
    public record DirectNotificationRequested(UUID senderUserId, UUID recipientUserId, String message) {}
    public record HrPerformanceNotificationRequested(UUID teamLeadUserId, UUID departmentId, String message) {}
}
