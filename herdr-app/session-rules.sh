#!/bin/sh
# SessionStart hook: only sessions inside herdr-core terminals (the Herdr desktop app) get the rules.
# Terminal-herdr sessions carry HERDR_* instead, so they stay unaffected.
[ -n "${HC_TERMINAL_ID-}" ] || exit 0
cat "$(dirname "$0")/session-rules.md"
