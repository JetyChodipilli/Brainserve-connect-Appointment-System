package com.brainserve.appointment.teamlead.api;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TeamLeadDirectory {
    Optional<Assignment> activeForHost(UUID hostEmployeeId);
    Assignment requireAssignedForHost(UUID teamLeadUserId, UUID hostEmployeeId);
    Assignment requireForUser(UUID teamLeadUserId);
    List<Assignment> activeAssignments();
    void endForEmployeeIfAssigned(UUID actorUserId, UUID employeeId);
    void replaceForAccountClosure(UUID actorUserId, UUID closingTeamLeadUserId, UUID replacementEmployeeId);

    record Assignment(UUID assignmentId, UUID departmentId, UUID teamLeadUserId,
                      UUID teamLeadEmployeeId, String fullName, String email) {}
}
