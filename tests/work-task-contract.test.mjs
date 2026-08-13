import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sourceIncludes } from "./source-contract-utils.mjs";

const read = (path) =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const domain = read(
    "backend/src/main/java/com/brainserve/appointment/worktask/domain/DepartmentWorkTask.java",
);
const service = read(
    "backend/src/main/java/com/brainserve/appointment/worktask/application/DepartmentWorkTaskService.java",
);
const controller = read(
    "backend/src/main/java/com/brainserve/appointment/worktask/api/DepartmentWorkTaskController.java",
);
const listener = read(
    "backend/src/main/java/com/brainserve/appointment/notification/application/WorkTaskNotificationListener.java",
);
const notificationService = read(
    "backend/src/main/java/com/brainserve/appointment/notification/application/InternalCallNotificationService.java",
);
const migration = read(
    "backend/src/main/resources/db/migration/V19__department_work_tasks.sql",
);
const branchMigration = read(
    "backend/src/main/resources/db/migration/V20__work_task_department_branch.sql",
);
const roles = read(
    "backend/src/main/java/com/brainserve/appointment/iam/domain/SystemRole.java",
);
const api = read("app/lib/api.ts");
const app = read("app/brainserve-app.tsx");

test("Employee and Team Lead use a work board instead of appointment navigation", () => {
  assert.ok(
      app.includes('"Team Lead": ["overview", "work"'),
  );
  assert.ok(
      app.includes('Employee: ["overview", "work"'),
  );
  assert.ok(
      app.includes('{ id: "work", label: "Work board"'),
  );
  assert.ok(
      app.includes(
          "Visitor updates stay in Notifications",
      ),
  );
  assert.ok(
      app.includes("Department visitor approvals"),
  );
});

test("task sheets never fall back to another employee's assignments", () => {
  assert.ok(
      app.includes(
          'if (role === "Employee" && !currentEmployeeId)',
      ),
  );
  assert.ok(
      app.includes(
          "values.filter((item) => item.employeeId === currentEmployeeId)",
      ),
  );
  assert.ok(app.includes("setTasks([])"));
  assert.ok(
      app.includes(
          "Other employees’ work is never shown",
      ),
  );
  assert.ok(app.includes("Create task sheet"));
  assert.ok(app.includes("NEW TASK SHEET"));
  assert.ok(app.includes("Worksheet instructions"));
  assert.ok(
      app.includes('className="task-sheet-grid"'),
  );
});

test("demo organization and Team Lead scope persist across login sessions", () => {
  assert.ok(app.includes("DEMO_EMPLOYEES_KEY"));
  assert.ok(app.includes("DEMO_DEPARTMENTS_KEY"));
  assert.ok(
      app.includes("DEMO_TEAM_LEAD_ASSIGNMENTS_KEY"),
  );
  assert.ok(
      app.includes("writeDemoEmployees(updated)"),
  );
  assert.ok(
      app.includes("writeDemoDepartments(updated)"),
  );
  assert.ok(
      app.includes(
          "writeDemoTeamLeadAssignments(updated)",
      ),
  );
  assert.ok(
      app.includes(
          'assignedByUserId: "demo-legacy-migration"',
      ),
  );
  assert.ok(
      app.includes(
          "if (migrated) writeDemoTeamLeadAssignments(assignments)",
      ),
  );
  assert.ok(
      sourceIncludes(
          app,
          "isBackendConfigured ? [] : readDemoEmployees()",
      ),
  );
  assert.ok(
      sourceIncludes(
          app,
          "isBackendConfigured ? [] : readDemoDepartments()",
      ),
  );
  assert.ok(
      sourceIncludes(
          app,
          "isBackendConfigured ? [] : readDemoTeamLeadAssignments()",
      ),
  );
});

test("work tasks follow the employee and Team Lead verification state machine", () => {
  for (const transition of [
    "start",
    "complete",
    "requestChanges",
    "approve",
    "acknowledge",
  ]) {
    assert.ok(
        domain.includes(`void ${transition}`),
        `missing ${transition}`,
    );
  }

  for (const status of [
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "CHANGES_REQUESTED",
    "APPROVED",
    "ACKNOWLEDGED",
  ]) {
    assert.ok(
        migration.includes(`'${status}'`),
        `missing ${status}`,
    );
  }
});

test("backend scopes tasks to the assigned Employee and Team Lead department", () => {
  assert.ok(
      service.includes(
          "WORK_TASK_DEPARTMENT_MISMATCH",
      ),
  );
  assert.ok(
      service.includes(
          "WORK_TASK_TEAM_LEAD_SCOPE_DENIED",
      ),
  );
  assert.ok(
      service.includes(
          "WORK_TASK_EMPLOYEE_SCOPE_DENIED",
      ),
  );
  assert.ok(
      service.includes("teamLeads.requireForUser"),
  );
  assert.ok(service.includes("activeByEmployeeId"));
  assert.ok(
      service.includes(
          "organization.requireActiveDepartment(lead.departmentId())",
      ),
  );
  assert.ok(service.includes("department.name()"));
  assert.ok(
      app.includes(
          "item.departmentId === teamLeadDepartmentId",
      ),
  );
  assert.ok(
      app.includes(
          "item.employeeId === currentEmployeeId",
      ),
  );
});

test("task endpoints use explicit role permissions", () => {
  for (const permission of [
    "WORK_TASK_READ",
    "WORK_TASK_CREATE",
    "WORK_TASK_PROGRESS",
    "WORK_TASK_REVIEW",
    "WORK_TASK_PERFORMANCE_READ",
  ]) {
    assert.ok(
        controller.includes(permission),
        `controller missing ${permission}`,
    );
    assert.ok(
        roles.includes(permission),
        `role catalog missing ${permission}`,
    );
  }

  assert.ok(
      controller.includes("hasRole('TEAM_LEAD')"),
  );
  assert.ok(
      controller.includes("hasRole('EMPLOYEE')"),
  );
  assert.ok(
      controller.includes("hasRole('HR_ADMIN')"),
  );
});

test("Kafka task and HR performance messages publish only after commit", () => {
  assert.ok(
      listener.includes(
          "TransactionPhase.AFTER_COMMIT",
      ),
  );
  assert.ok(
      listener.includes('@Async("notificationExecutor")'),
  );
  assert.ok(listener.includes("sendWorkTaskUpdate"));
  assert.ok(
      listener.includes("notifyHrOfWorkTaskApproval"),
  );
  assert.ok(
      notificationService.includes(
          "WORK_TASK_NOTIFICATION_ROUTE_DENIED",
      ),
  );
});

test("PostgreSQL and frontend use department branches, performance and all workflow actions", () => {
  for (const field of [
    "employee_id",
    "team_lead_user_id",
    "due_date",
    "employee_update",
    "team_lead_review",
    "approved_at",
    "acknowledged_at",
  ]) {
    assert.ok(
        migration.includes(field),
        `migration missing ${field}`,
    );
  }

  assert.ok(migration.includes("ix_work_task_department"));
  assert.ok(
      branchMigration.includes("department_branch"),
  );
  assert.ok(
      branchMigration.includes(
          "FROM org_department department",
      ),
  );
  assert.ok(
      branchMigration.includes("DROP COLUMN category"),
  );

  for (const call of [
    "workTasks",
    "createWorkTask",
    "updateWorkTask",
    "acknowledgeWorkTask",
    "teamLeadPerformance",
  ]) {
    assert.ok(
        api.includes(call),
        `frontend API missing ${call}`,
    );
  }

  assert.ok(app.includes("Team Lead performance"));
  assert.ok(app.includes("Department / branch"));
  assert.ok(app.includes("No department assigned"));
  assert.ok(!app.includes("Category / stream"));
  assert.ok(app.includes("Employee work update"));
  assert.ok(app.includes("Team Lead decision"));
});