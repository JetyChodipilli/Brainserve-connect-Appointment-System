import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const auditService = read("backend/src/main/java/com/brainserve/appointment/audit/api/AuditService.java");
const realtimeController = read("backend/src/main/java/com/brainserve/appointment/realtime/api/RealtimeUpdateController.java");
const realtimeHub = read("backend/src/main/java/com/brainserve/appointment/realtime/application/RealtimeUpdateHub.java");
const realtimeListener = read("backend/src/main/java/com/brainserve/appointment/realtime/application/RealtimeWorkspaceListener.java");
const frontendApi = read("app/lib/api.ts");
const frontend = read("app/brainserve-app.tsx");

test("audited service changes broadcast only after their transaction commits", () => {
  assert.ok(auditService.includes("WorkspaceChangeEvent"));
  assert.ok(auditService.includes("eventPublisher.publishEvent"));
  assert.ok(auditService.includes("@Transactional\n    public void record"));
  assert.equal(auditService.includes("REQUIRES_NEW"), false,
    "audit events must join the business transaction so refreshes cannot race its commit");
  assert.ok(realtimeListener.includes("TransactionPhase.AFTER_COMMIT"));
  assert.ok(realtimeListener.includes("broadcastRefresh"));
});

test("live workspace stream is authenticated, resilient and data-minimal", () => {
  assert.ok(realtimeController.includes('@RequestMapping("/api/v1/realtime")'));
  assert.ok(realtimeController.includes('@PreAuthorize("isAuthenticated()")'));
  assert.ok(realtimeController.includes('produces = MediaType.TEXT_EVENT_STREAM_VALUE'));
  assert.ok(realtimeHub.includes('"workspace-refresh", "refresh"'));
  assert.ok(realtimeHub.includes('@Scheduled(fixedDelay = 25_000L)'));
  assert.equal(realtimeHub.includes("targetId"), false, "the broadcast must not expose record identifiers");
});

test("frontend subscribes with the access token and refreshes every role-scoped view", () => {
  assert.ok(frontendApi.includes("subscribeToWorkspaceUpdates"));
  assert.ok(frontendApi.includes('Authorization: `Bearer ${accessToken}`'));
  assert.ok(frontendApi.includes('eventName === "workspace-refresh"'));
  assert.ok(frontendApi.includes("scheduleReconnect"));
  assert.ok(frontend.includes("setWorkspaceRevision"));
  assert.ok(frontend.includes('key={`insights:${workspaceRevision}`}'));
  assert.ok(frontend.includes('key={`notifications:${workspaceRevision}`}'));
  assert.ok(frontend.includes('className={`live-status'));
});

test("public brand and internal-call language are product-facing", () => {
  assert.ok(frontend.includes('productName="BrainServe Connect"'));
  assert.ok(frontend.includes('eyebrow="BRAINSERVE INTERNAL DELIVERY"'));
  assert.equal(/kafka/i.test(frontend), false, "technical Kafka wording must not leak into the interface");
});
