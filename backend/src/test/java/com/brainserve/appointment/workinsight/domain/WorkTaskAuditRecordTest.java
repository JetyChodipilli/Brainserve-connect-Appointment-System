package com.brainserve.appointment.workinsight.domain;

import com.brainserve.appointment.shared.application.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WorkTaskAuditRecordTest {
    private WorkTaskAuditRecord record() {
        return new WorkTaskAuditRecord(UUID.randomUUID(), LocalDate.now(), UUID.randomUUID(), "Technology",
                UUID.randomUUID(), "BSPL-TECH-0001", "Employee One", UUID.randomUUID(), "Team Lead One",
                "Validate visitor routing", "APPROVED", UUID.randomUUID());
    }

    @Test
    void ceoApprovesHrAuditedRecord() {
        WorkTaskAuditRecord record = record();
        record.decide(UUID.randomUUID(), true, "Evidence verified");
        assertThat(record.getAuditStatus()).isEqualTo(WorkInsightStatus.CEO_APPROVED);
        assertThat(record.getCeoDecidedAt()).isNotNull();
    }

    @Test
    void ceoCannotDecideSameAuditTwice() {
        WorkTaskAuditRecord record = record();
        record.decide(UUID.randomUUID(), false, "Missing evidence");
        assertThatThrownBy(() -> record.decide(UUID.randomUUID(), true, "Retry"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already has a CEO decision");
    }

    @Test
    void rejectedAuditBecomesTeamLeadReworkThenCanBeResubmitted() {
        WorkTaskAuditRecord record = record();
        record.decide(UUID.randomUUID(), false, "Missing validation evidence");
        assertThat(record.getAuditStatus()).isEqualTo(WorkInsightStatus.CEO_REWORK_REQUESTED);
        assertThat(record.getReworkReason()).isEqualTo("Missing validation evidence");
        record.assignRework("Repeat validation and attach the failed cases", "CHANGES_REQUESTED");
        assertThat(record.getAuditStatus()).isEqualTo(WorkInsightStatus.REWORK_ASSIGNED);
        record.resubmit(UUID.randomUUID(), "APPROVED");
        assertThat(record.getAuditStatus()).isEqualTo(WorkInsightStatus.PENDING_CEO_APPROVAL);
        assertThat(record.getReworkCycle()).isEqualTo(1);
    }

    @Test
    void rejectionRequiresReason() {
        assertThatThrownBy(() -> record().decide(UUID.randomUUID(), false, " "))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("rejection reason");
    }
}
