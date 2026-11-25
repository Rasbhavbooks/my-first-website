import assert from "node:assert/strict";
import test from "node:test";
import { cataloguePriceFilter } from "./catalogue-query.js";

test("catalogue price filter maps free and paid books to exact price conditions", () => {
  assert.deepEqual(cataloguePriceFilter("all"), {});
  assert.deepEqual(cataloguePriceFilter("free"), { price: 0 });
  assert.deepEqual(cataloguePriceFilter("paid"), { price: { $gt: 0 } });
});

test("catalogue price filter rejects unknown values", () => {
  assert.equal(cataloguePriceFilter("0"), null);
  assert.equal(cataloguePriceFilter(["free"]), null);
});
