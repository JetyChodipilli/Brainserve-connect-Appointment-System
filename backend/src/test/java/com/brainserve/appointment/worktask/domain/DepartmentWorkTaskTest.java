package com.brainserve.appointment.worktask.domain;

import com.brainserve.appointment.shared.application.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DepartmentWorkTaskTest {
    private DepartmentWorkTask task() {
        return new DepartmentWorkTask(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "Complete visitor workflow tests", "Validate the end-to-end approval contracts",
                "Technology", LocalDate.now().plusDays(3));
    }

    @Test
    void employeeCompletesTeamLeadApprovesAndEmployeeAcknowledges() {
        DepartmentWorkTask task = task();

        task.start("API contract tests started");
        task.complete("All workflow tests pass");
        task.approve("Acceptance criteria verified");
        task.acknowledge();

        assertThat(task.getStatus()).isEqualTo(WorkTaskStatus.ACKNOWLEDGED);
        assertThat(task.getStartedAt()).isNotNull();
        assertThat(task.getCompletedAt()).isNotNull();
        assertThat(task.getApprovedAt()).isNotNull();
        assertThat(task.getAcknowledgedAt()).isNotNull();
    }

    @Test
    void requestedChangesReturnTheTaskToEmployeeProgress() {
        DepartmentWorkTask task = task();
        task.complete("Initial delivery");
        task.requestChanges("Add the missing HR routing test");

        assertThat(task.getStatus()).isEqualTo(WorkTaskStatus.CHANGES_REQUESTED);
        task.start("Adding the HR test");
        assertThat(task.getStatus()).isEqualTo(WorkTaskStatus.IN_PROGRESS);
    }

    @Test
    void employeeCannotAcknowledgeBeforeTeamLeadApproval() {
        assertThatThrownBy(() -> task().acknowledge())
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("ASSIGNED");
    }

    @Test
    void insightsRejectionWaitsForTeamLeadPlanBeforeEmployeeRework() {
        DepartmentWorkTask task = task();
        task.complete("Initial delivery");
        task.approve("Team Lead verified");
        task.requestInsightRework("CEO", "Evidence does not cover the failure path");

        assertThat(task.getStatus()).isEqualTo(WorkTaskStatus.INSIGHT_REWORK_REQUESTED);
        assertThat(task.getReworkCycle()).isEqualTo(1);
        assertThatThrownBy(() -> task.start("Starting without Team Lead guidance"))
                .isInstanceOf(BusinessException.class);

        task.assignInsightRework("Add failure-path evidence and rerun the suite");
        assertThat(task.getStatus()).isEqualTo(WorkTaskStatus.CHANGES_REQUESTED);
        task.start("Rework started");
        task.complete("Failure-path evidence attached");
        task.approve("Rework verified");
        assertThat(task.getStatus()).isEqualTo(WorkTaskStatus.APPROVED);
    }

    @Test
    void openTasksMoveToAReplacementLeadButApprovedHistoryDoesNot() {
        UUID previousLead = UUID.randomUUID();
        UUID replacementLead = UUID.randomUUID();
        var open = new DepartmentWorkTask(UUID.randomUUID(), UUID.randomUUID(), previousLead,
                "Prepare compliance evidence", "Attach the current visitor trail", "Operations",
                LocalDate.now().plusDays(2));
        open.reassignOpenTask(previousLead, replacementLead);
        assertThat(open.getTeamLeadUserId()).isEqualTo(replacementLead);

        var approved = new DepartmentWorkTask(UUID.randomUUID(), UUID.randomUUID(), previousLead,
                "Closed delivery", "Retain its original approval owner", "Operations", LocalDate.now());
        approved.complete("Done");
        approved.approve("Verified");
        approved.reassignOpenTask(previousLead, replacementLead);
        assertThat(approved.getTeamLeadUserId()).isEqualTo(previousLead);
    }
}
