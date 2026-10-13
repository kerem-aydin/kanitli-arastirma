import test from "node:test";
import assert from "node:assert/strict";
import { hasPaymentEvidence, pilotGate, checkScore, checkLedger } from "../src/rules.js";

test("wishes and complaint counts are not payment evidence", () => {
  assert.equal(hasPaymentEvidence([{ cls: 5, url: "https://x.com/a", date: "2026-10-01" }]), false);
  assert.equal(hasPaymentEvidence([{ cls: 2, url: "", date: "2026-10-01" }]), false, "no source, no evidence");
  assert.equal(hasPaymentEvidence([{ cls: 2, url: "https://play.google.com/r/1", date: "2026-09-12" }]), true);
});

test("pilot gate: read 10 by hand before any full run", () => {
  assert.equal(pilotGate({ read: 6, relevant: 6, rightVoice: 6 }).decision, "read more");
  assert.deepEqual(pilotGate({ read: 10, relevant: 7, rightVoice: 2 }), { decision: "drop", share: 0.2 });
  assert.deepEqual(pilotGate({ read: 10, relevant: 8, rightVoice: 6 }), { decision: "full run", share: 0.6 });
});

const part = (points, extra = {}) => ({ points, reason: "one line", ...extra });
const full = { pain: part(10), payment: part(8), scale: part(10), buildSpeed: part(12), access: part(9), gap: part(5), recurring: part(3) };

test("score adds up and stays within each part's range", () => {
  assert.deepEqual(checkScore(full), { total: 57, errors: [] });
  assert.match(checkScore({ ...full, gap: part(14) }).errors[0], /outside 0-10/);
  assert.match(checkScore({ ...full, scale: { points: 5 } }).errors[0], /no reason/);
});

test("a high pain or payment score without a source is rejected", () => {
  assert.match(checkScore({ ...full, payment: part(15) }).errors[0], /needs a sourced quote/);
  assert.deepEqual(checkScore({ ...full, payment: part(15, { source: "https://example.com/pricing" }) }).errors, []);
});

test("ledger: every claim has url, date and a short verbatim quote", () => {
  const ok = { claim: "paid", url: "https://example.com", date: "2026-09", quote: "we pay $40 a month" };
  assert.deepEqual(checkLedger([ok]), []);
  assert.deepEqual(checkLedger([{ ...ok, url: "example.com", date: "last year" }]), ["entry 1 (paid): bad url, date"]);
});
