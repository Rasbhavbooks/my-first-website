import test from "node:test";
import assert from "node:assert/strict";
import { validateAccountDeletionRequest } from "./account-deletion.controller.js";

test("deletion requires password reauthentication and exact typed confirmation", () => {
  assert.equal(validateAccountDeletionRequest("reader", null).code, "CURRENT_PASSWORD_REQUIRED");
  assert.equal(validateAccountDeletionRequest("reader", { currentPassword: "secret", confirmation: "delete" }).code, "DELETE_CONFIRMATION_REQUIRED");
  assert.equal(validateAccountDeletionRequest("reader", { currentPassword: "secret", confirmation: "DELETE" }), null);
});

test("administrator deletion is blocked", () => {
  assert.deepEqual(validateAccountDeletionRequest("admin", {}), { status: 403, code: "ADMIN_ACCOUNT_DELETION_UNAVAILABLE" });
});
