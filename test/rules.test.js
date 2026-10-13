import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hasPaymentEvidence, pilotGate, checkScore, checkLedger, isUrl, isDate } from "../src/rules.js";
import { checkLine } from "../src/check.js";

test("wishes and complaint counts are not payment evidence", () => {
  assert.equal(hasPaymentEvidence([{ cls: 5, url: "https://x.com/a", date: "2026-10-01" }]), false);
  assert.equal(hasPaymentEvidence([{ cls: 2, url: "", date: "2026-10-01" }]), false, "no source, no evidence");
  assert.equal(hasPaymentEvidence([{ cls: 2, url: "https://play.google.com/r/1", date: "2026-09-12" }]), true);
});

test("a broken URL or an impossible date is not a source", () => {
  for (const url of ["https://", "http://localhost", "https:/x.com", "httpx://x.com", "see https://x.com"]) {
    assert.equal(isUrl(url), false, url);
    assert.equal(hasPaymentEvidence([{ cls: 2, url, date: "2026-09-12" }]), false, url);
  }
  for (const date of ["2026-13", "2026-02-30", "2026-9-1", "last year", "yes"]) {
    assert.equal(isDate(date), false, date);
    assert.equal(hasPaymentEvidence([{ cls: 2, url: "https://x.com/r", date }]), false, date);
  }
  assert.ok(isDate("2024-02-29"), "leap day exists");
});

test("pilot gate: read 10 by hand before any full run", () => {
  assert.equal(pilotGate({ read: 6, relevant: 6, rightVoice: 6, both: 6 }).decision, "read more");
  assert.deepEqual(pilotGate({ read: 10, relevant: 7, rightVoice: 2, both: 2 }), { decision: "drop", share: 0.2 });
  assert.deepEqual(pilotGate({ read: 10, relevant: 8, rightVoice: 6, both: 6 }), { decision: "full run", share: 0.6 });
});

test("pilot gate counts the overlap, not the smaller of two counts", () => {
  /* 7 relevant and 6 right-voice out of 10 can overlap in as few as 3. The old
     version took min(7, 6) = 6 and let this query through at 60%. */
  assert.deepEqual(pilotGate({ read: 10, relevant: 7, rightVoice: 6, both: 3 }), { decision: "drop", share: 0.3 });
  assert.throws(() => pilotGate({ read: 10, relevant: 7, rightVoice: 6 }), /needs `both`/);
  assert.throws(() => pilotGate({ read: 10, relevant: 4, rightVoice: 6, both: 5 }), /larger than/);
});

const part = (points, extra = {}) => ({ points, reason: "one line", ...extra });
const full = { pain: part(10), payment: part(8), scale: part(10), buildSpeed: part(12), access: part(9), gap: part(5), recurring: part(3) };

test("score adds up and stays within each part's range", () => {
  assert.deepEqual(checkScore(full), { total: 57, errors: [] });
  assert.match(checkScore({ ...full, gap: part(14) }).errors[0], /outside 0-10/);
  assert.match(checkScore({ ...full, scale: { points: 5 } }).errors[0], /no reason/);
});

test("a score that is not a number is missing, not zero", () => {
  const nan = Object.fromEntries(Object.keys(full).map((k) => [k, part(NaN)]));
  assert.equal(checkScore(nan).errors.length, 7);
  assert.match(checkScore({ ...full, pain: part(Infinity) }).errors[0], /pain: missing/);
});

test("a high pain or payment score needs a source AND a quote", () => {
  assert.match(checkScore({ ...full, payment: part(15) }).errors[0], /needs a sourced quote/);
  assert.match(checkScore({ ...full, payment: part(15, { source: "https://example.com/pricing" }) }).errors[0],
    /needs a sourced quote/, "a URL without the quote is not enough");
  assert.deepEqual(checkScore({ ...full, payment: part(15, { source: "https://example.com/pricing", quote: "Pro plan $29/month" }) }).errors, []);
});

test("ledger: every claim has url, date and a short verbatim quote", () => {
  const ok = { claim: "paid", url: "https://example.com", date: "2026-09", quote: "we pay $40 a month" };
  assert.deepEqual(checkLedger([ok]), []);
  assert.deepEqual(checkLedger([{ ...ok, url: "example.com", date: "last year" }]), ["entry 1 (paid): bad url, date"]);
  assert.deepEqual(checkLedger([{ ...ok, date: "2026-02-30" }]), ["entry 1 (paid): bad date"]);
  assert.deepEqual(checkLedger({ not: "a list" }), ["ledger is not a list"]);
});

test("check.js reads a line's files the way run.sh does", () => {
  const dir = mkdtempSync(join(tmpdir(), "line-"));
  try {
    const w = (name, data) => writeFileSync(join(dir, name), typeof data === "string" ? data : JSON.stringify(data));
    assert.deepEqual(checkLine(dir, "deep"), ["ledger.json: missing", "deep.json: missing"]);

    w("ledger.json", [{ claim: "paid", url: "https://example.com/p", date: "2026-09-01", quote: "we pay $40" }]);
    w("deep.json", [{ problem: "a", score: full }, { problem: "b", score: { ...full, gap: part(9) } }]);
    assert.deepEqual(checkLine(dir, "deep"), ["deep.json 2: not sorted by score"]);

    w("deep.json", "{ half a file");
    assert.match(checkLine(dir, "fix")[0], /deep\.json: not valid JSON/);

    w("pilot-decisions.json", [{ query: "q", read: 10, relevant: 7, rightVoice: 6, both: 3, decision: "full run" }]);
    assert.deepEqual(checkLine(dir, "scan"), ['pilot 1 (q): says "full run", numbers say "drop"']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
