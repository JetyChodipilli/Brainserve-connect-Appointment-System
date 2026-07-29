import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync("app/brainserve-app.tsx", "utf8");
const api = readFileSync("app/lib/api.ts", "utf8");
const service = readFileSync("backend/src/main/java/com/brainserve/appointment/notification/application/InternalCallNotificationService.java", "utf8");
const controller = readFileSync("backend/src/main/java/com/brainserve/appointment/notification/api/InternalCallNotificationController.java", "utf8");
const migration = readFileSync("backend/src/main/resources/db/migration/V31__notification_archive_and_deletion_audit.sql", "utf8");

test("notification workspace keeps today operational and exposes a separate archive", () => {
  assert.match(ui, /Today’s conversations/);
  assert.match(ui, /Sent today/);
  assert.match(ui, /Messages move here automatically after the office day ends/);
  assert.match(ui, /Delete old message/);
  assert.match(ui, /className="archive-shortcut"/);
  assert.match(api, /internalNotificationArchive/);
  assert.match(controller, /@GetMapping\("\/archive"\)/);
  assert.match(service, /findInboxForDay/);
});

test("today message deletion is blocked by the backend and every deletion is logged", () => {
  assert.match(service, /TODAY_MESSAGE_DELETE_FORBIDDEN/);
  assert.match(service, /You can delete only your own archived messages/);
  assert.match(service, /ARCHIVED_MESSAGE_DELETED/);
  assert.match(service, /Message snapshot:/);
  assert.match(controller, /@DeleteMapping\("\/\{notificationId\}"\)/);
  assert.match(migration, /deleted_by_user_id/);
  assert.match(migration, /WHERE deleted_at IS NULL/);
});
