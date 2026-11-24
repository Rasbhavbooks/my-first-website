import assert from "node:assert/strict";
import test from "node:test";
import DigitalBookEntitlement from "./book-entitlement.model.js";

test("book entitlements keep the paid order facts immutable and provider references private", () => {
  for (const field of ["readerId", "bookId", "orderId", "sourceLedgerId", "amountPaise", "currency", "grantedAt"]) {
    assert.equal(DigitalBookEntitlement.schema.path(field).options.immutable, true, field);
  }
  assert.equal(DigitalBookEntitlement.schema.path("sourceLedgerId").options.select, false);
  assert.equal(DigitalBookEntitlement.schema.options.timestamps.updatedAt, false);
  assert.equal(
    DigitalBookEntitlement.schema.indexes().some(([fields, options]) => fields.readerId === 1 && fields.bookId === 1 && options.unique),
    true,
  );
  assert.equal(
    DigitalBookEntitlement.schema.indexes().some(([fields, options]) => fields.orderId === 1 && options.unique),
    true,
  );
});
