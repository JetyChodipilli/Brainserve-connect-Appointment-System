package com.brainserve.appointment.realtime.application;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RealtimeUpdateHub {

    private static final long SSE_TIMEOUT =
            30L * 60L * 1000L;

    private final Map<UUID, SseEmitter> emitters =
            new ConcurrentHashMap<>();

    /**
     * Connects the currently authenticated user to the realtime SSE stream.
     */
    public SseEmitter connect() {
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {

            throw new IllegalStateException(
                    "Authentication is required for realtime updates"
            );
        }

        UUID userId = extractUserId(authentication);

        return subscribe(userId);
    }

    /**
     * Extracts the user UUID from the authenticated JWT subject.
     */
    private UUID extractUserId(Authentication authentication) {
        String principalName = authentication.getName();

        if (principalName == null || principalName.isBlank()) {
            throw new IllegalStateException(
                    "Authenticated user identifier is missing"
            );
        }

        try {
            return UUID.fromString(principalName);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(
                    "Authenticated user identifier is not a valid UUID: "
                            + principalName,
                    exception
            );
        }
    }

    /**
     * Creates and registers an SSE connection for the user.
     */
    public SseEmitter subscribe(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException(
                    "User ID is required for realtime connection"
            );
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        SseEmitter previous = emitters.put(userId, emitter);

        if (previous != null) {
            try {
                previous.complete();
            } catch (RuntimeException ignored) {
                // The previous browser connection may already be closed.
            }
        }

        Runnable cleanup = () ->
                emitters.remove(userId, emitter);

        emitter.onCompletion(cleanup);

        emitter.onTimeout(() -> {
            cleanup.run();

            try {
                emitter.complete();
            } catch (RuntimeException ignored) {
                // The response may already be closed.
            }
        });

        emitter.onError(error -> cleanup.run());

        send(
                userId,
                emitter,
                "connected",
                Map.of(
                        "connected", true,
                        "timestamp", Instant.now().toString()
                )
        );

        return emitter;
    }

    /**
     * Sends an event to one connected user.
     */
    public void publish(
            UUID userId,
            String eventName,
            Object payload
    ) {
        if (userId == null
                || eventName == null
                || eventName.isBlank()) {
            return;
        }

        SseEmitter emitter = emitters.get(userId);

        if (emitter != null) {
            send(userId, emitter, eventName, payload);
        }
    }

    /**
     * Called by RealtimeWorkspaceListener after a database transaction commits.
     * It tells every connected frontend to reload workspace data.
     */
    public void broadcastRefresh() {
        Map<String, Object> payload = Map.of(
                "type", "WORKSPACE_REFRESH",
                "timestamp", Instant.now().toString()
        );

        emitters.forEach((userId, emitter) ->
                send(
                        userId,
                        emitter,
                        "refresh",
                        payload
                )
        );
    }

    /**
     * Sends periodic heartbeat events and removes closed browser connections.
     */
    @Scheduled(
            fixedDelayString =
                    "${brainserve.realtime.heartbeat-ms:25000}"
    )
    public void heartbeat() {
        Map<String, Object> payload = Map.of(
                "timestamp", Instant.now().toString()
        );

        emitters.forEach((userId, emitter) ->
                send(
                        userId,
                        emitter,
                        "heartbeat",
                        payload
                )
        );
    }

    /**
     * Safely sends an SSE event. Closed browser connections are removed
     * instead of allowing the exception to reach GlobalExceptionHandler.
     */
    private void send(
            UUID userId,
            SseEmitter emitter,
            String eventName,
            Object payload
    ) {
        try {
            SseEmitter.SseEventBuilder event =
                    SseEmitter.event()
                            .name(eventName)
                            .id(UUID.randomUUID().toString())
                            .data(payload);

            emitter.send(event);

        } catch (IOException | RuntimeException exception) {
            emitters.remove(userId, emitter);

            /*
             * Do not call emitter.complete() here.
             * The servlet response may already be closed or committed.
             */
        }
    }
}