import assert from "node:assert/strict";
import test from "node:test";
import { serializeBook } from "./books.controller.js";

const book = {
  _id: "private-mongo-id",
  catalogueId: "quiet-river",
  title: { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" },
  author: "A. Writer",
  price: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
};

test("public book serialization includes final test total and itemized quote", () => {
  const result = serializeBook(book);
  assert.equal(result.id, "quiet-river");
  assert.equal(result._id, undefined);
  assert.equal(result.customerPricePaise, 13929);
  assert.deepEqual(result.priceBreakdownPaise, {
    authorPrice: 10000,
    platformCommission: 3000,
    gst: 650,
    gatewayFee: 279,
    total: 13929,
  });
});

test("free book serialization keeps the customer total at zero", () => {
  const result = serializeBook({ ...book, price: 0 });
  assert.equal(result.customerPricePaise, 0);
  assert.deepEqual(result.priceBreakdownPaise, {
    authorPrice: 0,
    platformCommission: 0,
    gst: 0,
    gatewayFee: 0,
    total: 0,
  });
});
