#!/usr/bin/env bash
# Runs one research line end to end: scan → deep → (audit → fix) ×2 → result.
# Each stage is a separate headless Codex run with a fresh context.
# Usage:  bash run.sh lines/my-question
# Re-running resumes: a stage whose output file exists is skipped.
# Exit: 0 done · 3 usage limit (resume later) · 4 a stage produced no output.
set -u
DIR="$(cd "$1" && pwd)"
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/run.log"
mkdir -p "$DIR/raw" "$DIR/log"
[ -s "$DIR/QUESTION.md" ] || { echo "missing $DIR/QUESTION.md"; exit 2; }

stage(){ # name, expected output, timeout (s), instruction
  local NAME="$1" OUT="$2" TIME="$3" TASK="$4"
  if [ -s "$DIR/$OUT" ]; then echo "$(date '+%F %T') $NAME already done, skipped" >> "$LOG"; return 0; fi
  echo "$(date '+%F %T') $NAME started" >> "$LOG"
  timeout "$TIME" codex exec -s workspace-write \
    -c sandbox_workspace_write.network_access=true -c web_search=live -c model_reasoning_effort=high \
    --skip-git-repo-check -C "$DIR" \
    "First read $ROOT/method/rules.md, $ROOT/method/stages.md and QUESTION.md. $TASK Do not ask questions and do not stop early; when done, write a one-line summary." \
    </dev/null > "$DIR/log/$NAME.log" 2>&1
  # Match the CLI's real message, copied from a log, not a guess.
  if grep -qE "hit your [A-Za-z ]*limit|usage limit" "$DIR/log/$NAME.log"; then
    echo "$(date '+%F %T') $NAME: usage limit, resume later" >> "$LOG"; exit 3
  fi
  if [ ! -s "$DIR/$OUT" ]; then
    echo "$(date '+%F %T') $NAME: no output ($OUT)" >> "$LOG"; exit 4
  fi
  echo "$(date '+%F %T') $NAME done" >> "$LOG"
}

stage scan   S1-scan.md  23400 "Apply only 'Stage 1 · Scan'."
stage deep   S2-deep.md   9000 "Apply only 'Stage 2 · Deep verification'."
stage audit1 audit-1.md   3600 "Apply only 'Stage 3 · Adversarial audit', round N=1."
stage fix1   fix-1.md     5400 "Apply only 'Stage 4 · Fix', round N=1."
stage audit2 audit-2.md   3600 "Apply only 'Stage 3 · Adversarial audit', round N=2."
stage fix2   fix-2.md     5400 "Apply only 'Stage 4 · Fix', round N=2."
stage result RESULT.md    3600 "Apply only 'Stage 5 · Result'."
echo "$(date '+%F %T') LINE DONE" >> "$LOG"
