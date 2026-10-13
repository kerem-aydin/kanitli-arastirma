# Rules every run reads first

## Precision before volume
Count is not the goal. Report how many of the records you actually read were
relevant and from the right voice, not how many you downloaded.

## What counts as proof that people pay
Strongest first. Only classes 1-4 count; class 5 never counts alone; a
complaint count is never payment evidence.

1. Disclosed revenue, paying users or acquisition price (company report, reliable press).
2. First-person payment behaviour: "bought it", "pay yearly", "cancelled because of the price", "asked for a refund".
3. A paid ad that has been running for a long time.
4. A price page, a price change, a local price.
5. A wish: "I would pay for this".

Write payment queries for these classes ("cancelled subscription", "worth it",
"refund", "yearly plan"), not for the problem in general.

## Score (out of 100)
Pain 0-20 · Payment 0-20 · Scale 0-15 · Build speed 0-15 · Access to buyers 0-15 ·
Competitive gap 0-10 · Recurring revenue 0-5. One line of reason per part; pain
or payment of 12 or more needs a source URL and a verbatim quote. `src/rules.js`
checks this, and `run.sh` stops the line if `deep.json` fails it.

## Evidence ledger
Every claim that a decision rests on goes to `ledger.json` with URL, date and a
short verbatim quote. A claim without an entry does not exist. The runner
rejects entries with a malformed URL, an impossible date or no quote.

## People and data
Public content only. No logins, no messages to anyone, no personal data kept:
names and handles are removed when records are written. Quote public statements
of companies and founders; never name commenters.

## Money and limits
Every paid source has a written budget per line and the run stops when it is
reached. Paid plans, proxies and new cards are a human decision, never the agent's.

## Honesty
If a target cannot be reached, say why. Never pad with invented records. A run
that finds nothing strong says so in its first sentence.
