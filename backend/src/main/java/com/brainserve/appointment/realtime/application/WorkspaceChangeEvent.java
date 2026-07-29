package com.brainserve.appointment.realtime.application;

/**
 * A deliberately data-free signal that tells connected clients to refresh their
 * own role-scoped workspace after a committed audited change.
 */
public record WorkspaceChangeEvent(String eventType, String targetType, String targetId) {
}
