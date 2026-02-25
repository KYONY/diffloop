#!/bin/bash
set -euo pipefail

# DiffLoop Pre-Commit Hook
# Intercepts git commit and opens code review UI in browser.
# Set DIFFLOOP_SKIP=1 to bypass.

DIFFLOOP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="/tmp/diffloop"

# Read hook input from stdin
INPUT=$(cat)

# Parse the Bash command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only intercept git commit commands
if ! echo "$COMMAND" | grep -qE '^git\s+commit'; then
  exit 0
fi

# Skip if opted out
if [ -n "${DIFFLOOP_SKIP:-}" ]; then
  exit 0
fi

# Project-specific state file (threads persist between iterations)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""')
PROJECT_HASH=$(echo -n "$CWD" | md5sum | cut -c1-12)
STATE_FILE="$STATE_DIR/${PROJECT_HASH}.json"
RESPONSES_FILE="$STATE_DIR/${PROJECT_HASH}-responses.json"
mkdir -p "$STATE_DIR"

# Build stdin for diffloop
if [ -f "$STATE_FILE" ]; then
  STDIN_JSON=$(cat "$STATE_FILE")
else
  STDIN_JSON='{}'
fi

# Merge model responses if agent wrote them
if [ -f "$RESPONSES_FILE" ]; then
  RESPONSES=$(cat "$RESPONSES_FILE")
  STDIN_JSON=$(echo "$STDIN_JSON" | jq --argjson r "$RESPONSES" '.modelResponses = $r')
  rm -f "$RESPONSES_FILE"
fi

# Run diffloop (stderr has server info, suppress it)
RESULT=$(cd "$CWD" && echo "$STDIN_JSON" | bun "$DIFFLOOP_DIR/src/cli.ts" 2>/dev/null) || true

if [ -z "$RESULT" ]; then
  # diffloop failed or was killed — allow commit
  rm -f "$STATE_FILE"
  exit 0
fi

DECISION=$(echo "$RESULT" | jq -r '.decision // ""')

if [ "$DECISION" = "allow" ]; then
  # Approved — clean up and allow commit
  rm -f "$STATE_FILE" "$RESPONSES_FILE"
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Code review approved via DiffLoop"
    }
  }'
  exit 0
else
  # Denied — save state and block commit with feedback
  echo "$RESULT" | jq '{state: .state}' > "$STATE_FILE"

  FEEDBACK=$(echo "$RESULT" | jq -r '.feedback // "Review feedback provided"')

  # Extract thread info so the agent can write targeted responses
  THREADS_INFO=$(echo "$RESULT" | jq -r '
    .state.threads[] | select(.resolved == false) |
    "- \(.id) (\(.type)) \(.file):\(.line) — \(.messages[-1].text // "")"
  ' 2>/dev/null || true)

  if [ -n "$THREADS_INFO" ]; then
    FEEDBACK="$FEEDBACK
---
DIFFLOOP: After fixing the code, write your responses to each thread before retrying the commit.
Write JSON to: $RESPONSES_FILE
Format: [{\"threadId\":\"<id>\",\"text\":\"<your explanation of what you did>\"},...]

Threads:
$THREADS_INFO"
  fi

  jq -n --arg reason "$FEEDBACK" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi
