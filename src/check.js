#!/usr/bin/env node
// Checks a line's files with the rules in rules.js. run.sh calls it after each
// stage and does not mark the stage done unless it exits 0.
//
//   node src/check.js lines/my-question scan|deep|fix
//
// Prints one problem per line. Exit 0: clean · 1: problems · 2: usage.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { pilotGate, checkScore, checkLedger } from "./rules.js";

function readJson(dir, name, problems) {
  const path = join(dir, name);
  if (!existsSync(path)) { problems.push(`${name}: missing`); return null; }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    problems.push(`${name}: not valid JSON (${e.message})`);
    return null;
  }
}

export function checkLine(dir, stage) {
  const problems = [];
  if (stage === "scan") {
    const pilots = readJson(dir, "pilot-decisions.json", problems);
    if (pilots && !Array.isArray(pilots)) problems.push("pilot-decisions.json: not a list");
    for (const [i, p] of (Array.isArray(pilots) ? pilots : []).entries()) {
      try {
        const { decision } = pilotGate(p);
        if (p.decision !== decision) problems.push(`pilot ${i + 1} (${p.query ?? "?"}): says "${p.decision}", numbers say "${decision}"`);
      } catch (e) {
        problems.push(`pilot ${i + 1} (${p.query ?? "?"}): ${e.message}`);
      }
    }
  }
  if (stage === "deep" || stage === "fix") {
    const ledger = readJson(dir, "ledger.json", problems);
    if (ledger) problems.push(...checkLedger(ledger).map((x) => `ledger.json ${x}`));
    const deep = readJson(dir, "deep.json", problems);
    if (deep && !Array.isArray(deep)) problems.push("deep.json: not a list");
    let previous = Infinity;
    for (const [i, c] of (Array.isArray(deep) ? deep : []).entries()) {
      const { total, errors } = checkScore(c?.score);
      problems.push(...errors.map((x) => `deep.json ${i + 1} (${c?.problem ?? "?"}): ${x}`));
      if (total > previous) problems.push(`deep.json ${i + 1}: not sorted by score`);
      previous = total;
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [dir, stage] = process.argv.slice(2);
  if (!dir || !["scan", "deep", "fix"].includes(stage)) {
    console.error("usage: node src/check.js <line dir> scan|deep|fix");
    process.exit(2);
  }
  const problems = checkLine(dir, stage);
  for (const p of problems) console.log(p);
  process.exit(problems.length ? 1 : 0);
}
