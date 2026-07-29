package com.brainserve.appointment.reporting.api;

import com.brainserve.appointment.appointment.api.AppointmentRecords;
import com.brainserve.appointment.employee.api.EmployeeRecords;
import com.brainserve.appointment.reception.api.ReceptionRecords;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MonthlyRecordsControllerTest {
    private final AppointmentRecords appointments = mock(AppointmentRecords.class);
    private final EmployeeRecords employees = mock(EmployeeRecords.class);
    private final ReceptionRecords reception = mock(ReceptionRecords.class);
    private final MonthlyRecordsController controller = new MonthlyRecordsController(
            appointments, employees, reception, "Asia/Kolkata");

    @Test
    void monthlyRegisterContainsOnlyReceptionProcessedArrivalsWithTheirFullTrail() {
        UUID appointmentId = UUID.randomUUID();
        UUID hrEmployeeId = UUID.randomUUID();
        UUID securityUserId = UUID.randomUUID();
        UUID receptionUserId = UUID.randomUUID();
        Instant securityAt = Instant.parse("2026-07-14T04:10:00Z");
        Instant receptionAt = Instant.parse("2026-07-14T04:15:00Z");
        Instant checkedInAt = Instant.parse("2026-07-14T04:40:00Z");

        var visit = new AppointmentRecords.VisitRecord(appointmentId, "BSA-TEST-2026", "HR_VISIT",
                "APPROVED", "Booked Visitor", "visitor@example.com", "+919999999999", "Visitor Co",
                hrEmployeeId, Instant.parse("2026-07-14T05:00:00Z"), Instant.parse("2026-07-14T05:30:00Z"),
                "Original purpose", securityUserId, securityAt, "Arrived Visitor", "Confirmed HR meeting",
                "AADHAAR", "1234", "Identity matched", receptionUserId, receptionAt,
                "Reception verified identity", UUID.randomUUID(), Instant.parse("2026-07-14T04:20:00Z"),
                UUID.randomUUID(), Instant.parse("2026-07-14T04:25:00Z"),
                null, null, UUID.randomUUID(), Instant.parse("2026-07-14T04:35:00Z"), "Sent to HR cabin");
        when(appointments.receptionVisitsBetween(any(), any())).thenReturn(List.of(visit));
        when(employees.allEmployees()).thenReturn(List.of(new EmployeeRecords.EmployeeRecord(hrEmployeeId,
                "BS-HR-001", "Requested HR", "hr@brainserve.in", "HR Admin", "ACTIVE",
                LocalDate.of(2025, 1, 1), null)));
        when(employees.leavesOverlapping(any(), any())).thenReturn(List.of());
        when(reception.forAppointments(List.of(appointmentId))).thenReturn(List.of(
                new ReceptionRecords.AccessRecord(appointmentId, "B-101", checkedInAt, null, "Reception Desk")));

        var result = controller.monthly(2026, 7);

        assertThat(result.visitorCount()).isEqualTo(1);
        assertThat(result.visitors()).singleElement().satisfies(record -> {
            assertThat(record.visitorName()).isEqualTo("Arrived Visitor");
            assertThat(record.purpose()).isEqualTo("Confirmed HR meeting");
            assertThat(record.hostName()).isEqualTo("Requested HR");
            assertThat(record.securityIntakeAt()).isEqualTo(securityAt);
            assertThat(record.receptionVerifiedAt()).isEqualTo(receptionAt);
            assertThat(record.badgeNumber()).isEqualTo("B-101");
            assertThat(record.checkedInAt()).isEqualTo(checkedInAt);
        });
        verify(appointments).receptionVisitsBetween(
                Instant.parse("2026-06-30T18:30:00Z"), Instant.parse("2026-07-31T18:30:00Z"));
    }
}
