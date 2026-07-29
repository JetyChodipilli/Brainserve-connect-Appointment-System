import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync("app/brainserve-app.tsx", "utf8");
const controller = fs.readFileSync("backend/src/main/java/com/brainserve/appointment/employee/api/EmployeeController.java", "utf8");
const service = fs.readFileSync("backend/src/main/java/com/brainserve/appointment/employee/application/EmployeeService.java", "utf8");
const migration = fs.readFileSync("backend/src/main/resources/db/migration/V23__remove_legacy_reporting_manager.sql", "utf8");

test("employee onboarding derives leadership from the active department Team Lead", () => {
  assert.ok(app.includes("teamLeadAssignments={teamLeadAssignments}"));
  assert.ok(app.includes("assignment.active\n    && assignment.departmentId === departmentId"));
  assert.ok(app.includes("Department Team Lead"));
  assert.ok(app.includes("Resolved automatically from the active Team Lead assignment"));
  assert.ok(app.includes("No Team Lead assigned"));
});

test("ordinary employees are never submitted or accepted as reporting managers", () => {
  assert.ok(!app.includes('data.get("managerId")'));
  assert.ok(!app.includes("availableManagers"));
  assert.ok(!controller.includes("reportingManagerId"));
  assert.ok(!controller.includes('PatchMapping("/{id}/manager")'));
  assert.ok(!service.includes("validateManager"));
});

test("legacy reporting-manager schema is removed in favor of department leadership", () => {
  assert.ok(migration.includes("DROP COLUMN IF EXISTS reporting_manager_id"));
  assert.ok(migration.includes("department_team_lead"));
});
