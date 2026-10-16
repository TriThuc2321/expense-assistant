#!/usr/bin/env bash
# PostToolUse(Write|Edit): lint + format the single file Claude just touched.
# Mirrors the file-type split in .lintstagedrc.json so edits land pre-committed-clean.
# stdin: hook JSON. Never blocks — always exits 0.

set -uo pipefail
exec >/dev/null 2>&1

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

oxlint="$root/node_modules/.bin/oxlint"
oxfmt="$root/node_modules/.bin/oxfmt"

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs)
    [ -x "$oxlint" ] && "$oxlint" --fix "$file"
    [ -x "$oxfmt" ] && "$oxfmt" --write "$file"
    ;;
  *.json | *.jsonc | *.css | *.md | *.mdx | *.yml | *.yaml)
    [ -x "$oxfmt" ] && "$oxfmt" --write "$file"
    ;;
esac

exit 0
