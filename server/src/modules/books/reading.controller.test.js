import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { createEbookReader } from "./reading.controller.js";

function response() {
  return { headers: {}, statusCode: 200, setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;}, json(v){this.body=v;return this;},
    destroy(){this.wasDestroyed=true;return this;} };
}

test("streams only the approved PDF after reader access is confirmed", async () => {
  const body = Readable.from(["private pdf"]);
  const responseObject = response();
  const handler = createEbookReader({
    resolveAccess: async ({readerId}) => readerId ? {sourceId:"507f1f77bcf86cd799439011"} : null,
    findApprovedManuscript: async () => ({key:"private/key",scanStatus:"clean",contentType:"application/pdf",size:11}),
    getObject: async (key) => { assert.equal(key,"private/key"); return {Body:body}; },
  });
  await handler({params:{bookId:"quiet-river"},reader:{_id:"reader"}},responseObject);
  assert.equal(responseObject.headers["Cache-Control"],"private, no-store");
  assert.equal(responseObject.headers["Content-Type"],"application/pdf");
  assert.equal(responseObject.headers["X-Content-Type-Options"],"nosniff");
});

test("returns the same not found response without access and never fetches the file", async () => {
  let fetched=false;
  const res=response();
  const handler=createEbookReader({resolveAccess:async()=>null,findApprovedManuscript:async()=>null,getObject:async()=>{fetched=true;}});
  await handler({params:{bookId:"quiet-river"},reader:{_id:"reader"}},res);
  assert.equal(res.statusCode,404);
  assert.equal(fetched,false);
});
