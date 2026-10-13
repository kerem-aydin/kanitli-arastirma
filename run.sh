#!/usr/bin/env bash
# Runs one research line end to end: scan → deep → (audit → fix) ×2 → result.
# Each stage is a separate headless Codex run with a fresh context.
# Usage:  bash run.sh lines/my-question
#
# Re-running resumes. A stage counts as done only when the agent exited cleanly,
# its output file exists and the code checks in src/check.js pass; then a marker
# is written to .done/. An output file alone is not proof: a run that timed out
# or crashed can leave half a file behind.
#
# Exit: 0 done · 2 usage · 3 usage limit (resume later) · 4 agent failed or wrote
# nothing · 5 output fails the checks (listed in log/<stage>.problems).
set -u
DIR="$(cd "$1" && pwd)"
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/run.log"
mkdir -p "$DIR/raw" "$DIR/log" "$DIR/.done"
[ -s "$DIR/QUESTION.md" ] || { echo "missing $DIR/QUESTION.md"; exit 2; }

note(){ echo "$(date '+%F %T') $*" >> "$LOG"; }

stage(){ # name, expected output, timeout (s), check (scan|deep|fix|-), instruction
  local NAME="$1" OUT="$2" TIME="$3" CHECK="$4" TASK="$5"
  if [ -e "$DIR/.done/$NAME" ]; then note "$NAME already done, skipped"; return 0; fi
  local PROBLEMS="$DIR/log/$NAME.problems"
  if [ -s "$PROBLEMS" ]; then
    TASK="$TASK An earlier attempt of this stage failed the checks listed in log/$NAME.problems; fix every one of them."
  fi
  note "$NAME started"
  timeout "$TIME" codex exec -s workspace-write \
    -c sandbox_workspace_write.network_access=true -c web_search=live -c model_reasoning_effort=high \
    --skip-git-repo-check -C "$DIR" \
    "First read $ROOT/method/rules.md, $ROOT/method/stages.md and QUESTION.md. $TASK Do not ask questions and do not stop early; when done, write a one-line summary." \
    </dev/null > "$DIR/log/$NAME.log" 2>&1
  local RC=$?
  # Match the CLI's real message, copied from a log, not a guess.
  if grep -qE "hit your [A-Za-z ]*limit|usage limit" "$DIR/log/$NAME.log"; then
    note "$NAME: usage limit, resume later"; exit 3
  fi
  if [ "$RC" -ne 0 ]; then
    # 124 is timeout's code. Whatever was written is kept for reading but moved
    # aside, so the next run starts the stage clean instead of trusting it.
    [ -e "$DIR/$OUT" ] && mv "$DIR/$OUT" "$DIR/$OUT.failed-$(date +%Y%m%d-%H%M%S)"
    note "$NAME: agent exited with $RC, output moved aside"; exit 4
  fi
  if [ ! -s "$DIR/$OUT" ]; then note "$NAME: no output ($OUT)"; exit 4; fi
  if [ "$CHECK" != "-" ]; then
    if ! node "$ROOT/src/check.js" "$DIR" "$CHECK" > "$PROBLEMS"; then
      note "$NAME: $(wc -l < "$PROBLEMS") check problem(s), see log/$NAME.problems"; exit 5
    fi
    rm -f "$PROBLEMS"
  fi
  touch "$DIR/.done/$NAME"
  note "$NAME done"
}

stage scan   S1-scan.md  23400 scan "Apply only 'Stage 1 · Scan'."
stage deep   S2-deep.md   9000 deep "Apply only 'Stage 2 · Deep verification'."
stage audit1 audit-1.md   3600 -    "Apply only 'Stage 3 · Adversarial audit', round N=1."
stage fix1   fix-1.md     5400 fix  "Apply only 'Stage 4 · Fix', round N=1."
stage audit2 audit-2.md   3600 -    "Apply only 'Stage 3 · Adversarial audit', round N=2."
stage fix2   fix-2.md     5400 fix  "Apply only 'Stage 4 · Fix', round N=2."
stage result RESULT.md    3600 -    "Apply only 'Stage 5 · Result'."
note "LINE DONE"
