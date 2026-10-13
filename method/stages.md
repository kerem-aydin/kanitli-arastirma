# Stages

Every line of research follows the same five stages. Each stage is a separate
agent run with a fresh context, reads only files, and writes only files. A
stage counts as done only when the agent exited cleanly, its output file exists
and the code checks in `src/check.js` pass (`run.sh` then writes a marker to
`.done/`). Progress notes go to a separate file, so a half-finished run never
looks finished.

Each run first reads `rules.md` and the line's `QUESTION.md`.

## Stage 1 · Scan
1. **Source plan** → `source-plan.json`: for each source type in the question,
   the queries, brands and channels to pull.
2. **Pilot gate** before any full pull: fetch a small sample, read 10 records by
   hand, and record `{query, read, relevant, rightVoice, both, decision}` in
   `pilot-decisions.json`. `both` is the number of records that are relevant
   *and* from the right voice (the person who pays, not a bystander), counted
   while reading. Below 50%, the query is dropped. The runner recomputes every
   decision from the numbers and stops if they disagree.
3. **Collect** → `raw/<source>.jsonl`, personal data removed at write time.
   Free and public sources first. Every paid call has a hard budget.
4. **Filter by code, interpret by reading.** Language, length, duplicates and
   keyword pre-clusters are code. Meaning comes from reading stratified samples
   (at least 30 records per cluster). Counts are computed, never estimated.
5. **Cluster** → `clusters.json`: per problem, distinct people, source types,
   date spread, whose problem it is, 3 representative quotes (URL + date), how
   it is handled today, any trace of money.
6. Output: `S1-scan.md` with a source-yield table, so weak sources are visible.

## Stage 2 · Deep verification
For the strongest clusters, plus up to three that look underrated, live web research:
1. **Pain:** at least 3 different domains, one from the person who has it, verbatim.
2. **Payment:** evidence by class (see `rules.md`). Complaint counts do not count.
3. **Buyer:** who decides, who pays, how long the sale takes.
4. **Existing solutions** with prices, and why they are not enough (user words).
5. **Legal or platform limits**, only where they apply.
6. **Fit:** what we already have, how many weeks to a first working piece.
7. **Score** out of 100 (`rules.md`), one line of reason per part.
8. **Hypotheses** from the question: support / against / verdict.

Output: `S2-deep.md`, `ledger.json` (every claim with URL, date, quote) and
`deep.json`, a list sorted by total score:

```json
[{ "problem": "…", "score": { "pain": { "points": 14, "reason": "…", "source": "https://…", "quote": "…" },
                              "payment": { … }, "scale": { … }, "buildSpeed": { … },
                              "access": { … }, "gap": { … }, "recurring": { … } } }]
```

The runner checks both files with `src/rules.js` before the stage counts as done.

## Stage 3 · Adversarial audit (round N)
> You did not write this work and you have no reason to be kind. You are an
> operator who knows this market and an early-stage investor.

1. Score the top 5 problems 1-10 against one hard claim: *this is real, people
   pay for it, and one founder with AI tools can ship a first piece in 8 weeks
   and reach 3 paying customers in 60 days.*
2. Re-verify critical claims yourself (open at least 10 sources). Name every
   claim that is wrong, stale, unsourced or templated.
3. Is a bigger problem missing? Show its evidence.
4. For each problem: what would have to change to reach 10/10.
5. Mark the previous round's requests as open / partly / closed.

Writes only `audit-N.md`. Touches nothing else.

## Stage 4 · Fix (round N)
Close every item of `audit-N.md`: correct, source, re-score with reasons,
research a missed problem at stage-2 depth. Update `S2-deep.md` and
`deep.json`; list what was done in `fix-N.md`. What cannot be closed stays
honestly **open**.

Stages 3 and 4 run twice.

## Stage 5 · Result
`RESULT.md`, two pages at most, for a person who will decide, without jargon:
1. One-sentence verdict.
2. Strongest 3 problems: the two best pieces of evidence each, who pays, how much.
3. What happened to each hypothesis.
4. Recommended focus, at most three options with trade-offs.
5. A first test that checks the riskiest assumption in 3 days on a small budget.
6. **What desk research cannot answer**, and the field test that would.
