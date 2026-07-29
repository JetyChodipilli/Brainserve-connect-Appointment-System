package com.brainserve.appointment.workinsight.api;

import java.util.UUID;

public final class WorkInsightEvents {
    private WorkInsightEvents() {}
    public record HrAuditSubmitted(UUID hrUserId, String message) {}
    public record CeoDecisionRecorded(UUID ceoUserId, UUID hrUserId, String message) {}
    public record ReworkRequested(UUID reviewerUserId, UUID teamLeadUserId, String message) {}
    public record ReworkAssigned(UUID teamLeadUserId, UUID employeeUserId, String message) {}
}
