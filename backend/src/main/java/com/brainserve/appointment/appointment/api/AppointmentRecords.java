package com.brainserve.appointment.appointment.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AppointmentRecords {
    List<VisitRecord> receptionVisitsBetween(Instant fromInclusive, Instant toExclusive);

    record VisitRecord(UUID id, String referenceNumber, String type, String status, String visitorName,
                       String visitorEmail, String visitorPhone, String visitorCompany, UUID hostEmployeeId,
                       UUID routingDepartmentId, UUID requestedEmployeeId,
                       Instant slotStart, Instant slotEnd, String purpose,
                       UUID securityIntakeActorId, Instant securityIntakeAt, String arrivalVisitorName,
                       String arrivalPurpose, String identityDocumentType, String identityDocumentLastFour,
                       String securityNotes, UUID receptionVerificationActorId, Instant receptionVerifiedAt,
                       String receptionVerificationRemarks, UUID hrApprovalActorId, Instant hrDecisionAt,
                       UUID teamLeadApprovalActorId, Instant teamLeadDecisionAt,
                       UUID managerApprovalActorId, Instant managerDecisionAt,
                       UUID ceoApprovalActorId, Instant ceoDecisionAt, UUID receptionForwardActorId,
                       Instant receptionForwardedAt, String receptionForwardRemarks) {}
}
