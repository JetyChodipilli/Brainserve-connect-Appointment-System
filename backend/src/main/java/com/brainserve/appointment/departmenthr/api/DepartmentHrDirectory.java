package com.brainserve.appointment.departmenthr.api;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DepartmentHrDirectory {
    Optional<Assignment> activeForDepartment(UUID departmentId);
    Optional<Assignment> activeForUser(UUID hrUserId);
    Optional<Assignment> activeForHrEmployee(UUID hrEmployeeId);
    Assignment requireForDepartment(UUID departmentId);
    Assignment requireForUser(UUID hrUserId);
    Assignment requireAssignedReviewer(UUID departmentId, UUID hrUserId);
    List<Assignment> activeAssignments();
    void replaceForAccountClosure(UUID actorUserId, UUID closingHrUserId, UUID replacementHrUserId);

    record Assignment(UUID assignmentId, UUID departmentId, UUID hrUserId, UUID hrEmployeeId,
                      String fullName, String email) {}
}
