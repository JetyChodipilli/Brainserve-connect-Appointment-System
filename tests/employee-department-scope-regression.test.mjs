import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sourceIncludes } from "./source-contract-utils.mjs";

const service = readFileSync(
    new URL("../backend/src/main/java/com/brainserve/appointment/employee/application/EmployeeService.java", import.meta.url),
    "utf8",
);
const controller = readFileSync(
    new URL("../backend/src/main/java/com/brainserve/appointment/employee/api/EmployeeController.java", import.meta.url),
    "utf8",
);
const termination = readFileSync(
    new URL("../backend/src/main/java/com/brainserve/appointment/employee/application/EmployeeTerminationService.java", import.meta.url),
    "utf8",
);
const migration = readFileSync(
    new URL("../backend/src/main/resources/db/migration/V46__protect_active_ceo_employee_lifecycle.sql", import.meta.url),
    "utf8",
);
const ui = readFileSync(new URL("../app/brainserve-app.tsx", import.meta.url), "utf8");

test("HR and Team Lead employee lists are derived from their assigned department", () => {
    const hrScope = service.indexOf('actor.roles().contains("ROLE_HR_ADMIN")');
    const teamLeadScope = service.indexOf('actor.roles().contains("ROLE_TEAM_LEAD")');

    assert.ok(hrScope >= 0);
    assert.ok(teamLeadScope > hrScope);
    assert.ok(sourceIncludes(service, "departmentHrs.requireForUser(actorUserId).departmentId()"));
    assert.ok(sourceIncludes(service, "teamLeads.requireForUser(actorUserId).departmentId()"));
    assert.match(service, /EMPLOYEE_DEPARTMENT_SCOPE_DENIED/);
});

test("employee read and lifecycle endpoints pass the authenticated actor into scope checks", () => {
    assert.match(controller, /service\.list\(actor\(jwt\), query, departmentId, status, pageable\)/);
    assert.match(controller, /service\.getVisible\(actor\(jwt\), id\)/);
    assert.match(controller, /service\.changeStatusScoped\(actor\(jwt\), id, request\.status\(\)\)/);
    assert.match(controller, /service\.departmentSummaries\(actor\(jwt\)\)/);
});

test("department-scoped employee UI removes the company-wide department selector", () => {
    assert.match(ui, /const departmentScoped = role === "HR Admin" \|\| role === "Team Lead"/);
    assert.match(ui, /loadedEmployees\.filter\(\s*\(employee\) => employee\.departmentId === scopedDepartmentId/);
    assert.match(ui, /departmentId: selectedDepartment/);
    assert.match(ui, /departmentScoped \?[\s\S]*scoped-department-label[\s\S]*All departments/);
});

test("a CEO department profile is visible to HR but protected from lifecycle actions", () => {
    assert.ok(sourceIncludes(service, "requireLifecycleAuthority(actorUserId, employee)"));
    assert.match(service, /public boolean isChiefExecutive\(UUID employeeId\)/);
    assert.match(service, /public Set<UUID> chiefExecutiveEmployeeIds\(\)/);
    assert.ok(sourceIncludes(service, 'staff.activeWithAnyRole(Set.of("ROLE_CEO"))'));
    assert.ok(sourceIncludes(service, "findByOfficialEmailIgnoreCase(account.email())"));
    assert.match(service, /CEO_LIFECYCLE_PROTECTED/);
    assert.ok(sourceIncludes(service, 'rejectedSecurityAudit.record("CEO_LIFECYCLE_CHANGE_BLOCKED"'));
    assert.match(controller, /boolean lifecycleProtected/);
    assert.ok(sourceIncludes(controller, "lifecycleProtectedEmployeeIds.contains(value.getId())"));
    assert.ok(sourceIncludes(termination, "employees.isChiefExecutive(employeeId)"));
    assert.match(ui, /item\.lifecycleProtected/);
    assert.match(ui, /!isCompanyExecutive && transitions\(item\.status\)\.length/);
    assert.match(ui, /Company-wide authority · System Admin managed/);
    assert.match(ui, /protected-lifecycle-label/);
    assert.match(migration, /protect_active_ceo_employee_lifecycle/);
    assert.match(migration, /BEFORE UPDATE OF status, relieving_date ON employee/);
    assert.match(migration, /BEFORE DELETE ON employee/);
    assert.match(migration, /lower\(account\.email\) = lower\(OLD\.official_email\)/);
    assert.match(migration, /CEO_LIFECYCLE_PROTECTED/);
});
