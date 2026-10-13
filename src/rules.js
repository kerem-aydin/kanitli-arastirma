// The parts of the method that can be checked by code instead of trusted to a model.
// `src/check.js` runs these on a line's files after each stage; run.sh does not
// mark a stage done until they pass.

/* Payment evidence, strongest first. Complaint counts are not payment evidence:
   in one line of our research 30,679 "relevant" records still produced zero proof
   that anyone pays. Only these classes count, and class 5 never counts alone. */
export const PAYMENT_EVIDENCE = [
  { cls: 1, name: "disclosed revenue, paying users or acquisition price (company report, reliable press)" },
  { cls: 2, name: "first-person payment behaviour: bought, subscribed yearly, cancelled because of price, asked for a refund" },
  { cls: 3, name: "paid ad running for a long time (an unprofitable ad does not live long)" },
  { cls: 4, name: "price page, price change, local price" },
  { cls: 5, name: "wish only: 'I would pay for this' (weakest; never enough alone)" },
];

/** An http(s) URL with a real host, not just a string that starts with "http". */
export function isUrl(u) {
  const ham = String(u ?? "");
  // The URL parser forgives "https:/x.com"; a ledger entry should not.
  if (!/^https?:\/\/[^\s/]+/.test(ham)) return false;
  try {
    const x = new URL(ham);
    return (x.protocol === "http:" || x.protocol === "https:") && x.hostname.includes(".");
  } catch {
    return false;
  }
}

/** YYYY-MM or YYYY-MM-DD that exists on the calendar ("2026-13" and "2026-02-30" do not). */
export function isDate(d) {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(d ?? ""));
  if (!m) return false;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 1];
  if (mo < 1 || mo > 12) return false;
  const t = new Date(Date.UTC(y, mo - 1, day));
  return t.getUTCMonth() === mo - 1 && t.getUTCDate() === day;
}

/** Is there real payment evidence for a candidate? At least one class 1-4 item with a source and a date. */
export function hasPaymentEvidence(items) {
  return (items ?? []).some((e) => Number.isInteger(e?.cls) && e.cls >= 1 && e.cls <= 4 && isUrl(e.url) && isDate(e.date));
}

/* Pilot gate: every new query or source is first pulled small and 10 records
   are read by hand. Below 50% that are relevant AND from the right voice, it
   never goes to a full run.

   `both` is counted while reading: records that are relevant and from the right
   voice at the same time. It cannot be derived from the two separate counts:
   7 relevant and 6 right-voice out of 10 can overlap in as few as 3. */
export function pilotGate({ read, relevant, rightVoice, both }, { minRead = 10, minShare = 0.5 } = {}) {
  if (!Number.isInteger(read) || read < minRead) return { decision: "read more", share: null };
  if (!Number.isInteger(both) || both < 0) {
    throw new Error("pilotGate needs `both`: records that are relevant AND from the right voice");
  }
  if (both > read || (Number.isInteger(relevant) && both > relevant) || (Number.isInteger(rightVoice) && both > rightVoice)) {
    throw new Error(`pilotGate: both=${both} is larger than read, relevant or rightVoice`);
  }
  const share = both / read;
  return { decision: share >= minShare ? "full run" : "drop", share: Math.round(share * 100) / 100 };
}

/* Score out of 100. Every part needs a one-line reason; a pain or payment score
   of 12 or more needs a sourced, verbatim quote. */
export const SCORE = { pain: 20, payment: 20, scale: 15, buildSpeed: 15, access: 15, gap: 10, recurring: 5 };

export function checkScore(s) {
  const errors = [];
  let total = 0;
  for (const [k, max] of Object.entries(SCORE)) {
    const part = s?.[k];
    if (!part || !Number.isFinite(part.points)) { errors.push(`${k}: missing`); continue; }
    if (part.points < 0 || part.points > max) errors.push(`${k}: ${part.points} is outside 0-${max}`);
    if (!part.reason?.trim()) errors.push(`${k}: no reason`);
    if ((k === "pain" || k === "payment") && part.points >= 12 && !(isUrl(part.source) && part.quote?.trim())) {
      errors.push(`${k}: ${part.points} needs a sourced quote`);
    }
    total += part.points;
  }
  return { total, errors };
}

/** Every claim in the evidence ledger needs a URL, a date and a short verbatim quote. */
export function checkLedger(entries) {
  if (!Array.isArray(entries)) return ["ledger is not a list"];
  return entries.flatMap((e, i) => {
    const bad = [];
    if (!isUrl(e?.url)) bad.push("url");
    if (!isDate(e?.date)) bad.push("date");
    if (!e?.quote?.trim() || e.quote.length > 300) bad.push("quote");
    return bad.length ? [`entry ${i + 1} (${e?.claim ?? "?"}): bad ${bad.join(", ")}`] : [];
  });
}
