// The parts of the method that can be checked by code instead of trusted to a model.

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

/** Is there real payment evidence for a candidate? At least one class 1-4 item with a source. */
export function hasPaymentEvidence(items) {
  return items.some((e) => e.cls >= 1 && e.cls <= 4 && /^https?:\/\//.test(e.url ?? "") && e.date);
}

/* Pilot gate: every new query or source is first pulled small and 10 records
   are read by hand. Below 50% relevant-and-right-voice, it never goes to a full run. */
export function pilotGate({ read, relevant, rightVoice }, { minRead = 10, minShare = 0.5 } = {}) {
  if (read < minRead) return { decision: "read more", share: null };
  const share = Math.min(relevant, rightVoice) / read;
  return { decision: share >= minShare ? "full run" : "drop", share: Math.round(share * 100) / 100 };
}

/* Score out of 100. Every part needs a one-line reason; high pain and payment
   scores need a quoted, sourced line. */
export const SCORE = { pain: 20, payment: 20, scale: 15, buildSpeed: 15, access: 15, gap: 10, recurring: 5 };

export function checkScore(s) {
  const errors = [];
  let total = 0;
  for (const [k, max] of Object.entries(SCORE)) {
    const part = s[k];
    if (!part || typeof part.points !== "number") { errors.push(`${k}: missing`); continue; }
    if (part.points < 0 || part.points > max) errors.push(`${k}: ${part.points} is outside 0-${max}`);
    if (!part.reason?.trim()) errors.push(`${k}: no reason`);
    if ((k === "pain" || k === "payment") && part.points >= 12 && !/^https?:\/\//.test(part.source ?? "")) errors.push(`${k}: ${part.points} needs a sourced quote`);
    total += part.points;
  }
  return { total, errors };
}

/** Every claim in the evidence ledger needs a URL, a date and a short verbatim quote. */
export function checkLedger(entries) {
  return entries.flatMap((e, i) => {
    const bad = [];
    if (!/^https?:\/\//.test(e.url ?? "")) bad.push("url");
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(e.date ?? "")) bad.push("date");
    if (!e.quote?.trim() || e.quote.length > 300) bad.push("quote");
    return bad.length ? [`entry ${i + 1} (${e.claim ?? "?"}): bad ${bad.join(", ")}`] : [];
  });
}
