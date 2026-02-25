#!/bin/bash
set -euo pipefail

# DiffLoop Pre-Commit Hook
# Intercepts git commit and opens code review UI in browser.
# Set DIFFLOOP_SKIP=1 to bypass.

DIFFLOOP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Read hook input from stdin
INPUT=$(cat)

# Parse the Bash command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only intercept git commit commands
if ! echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+commit'; then
  exit 0
fi

# Skip if opted out
if [ -n "${DIFFLOOP_SKIP:-}" ]; then
  exit 0
fi

# Project-local state (threads persist between iterations, isolated per branch)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""')
BRANCH=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BRANCH_SAFE=$(echo "$BRANCH" | tr '/' '-')
STATE_DIR="$CWD/.diffloop/$BRANCH_SAFE"
STATE_FILE="$STATE_DIR/state.json"
RESPONSES_FILE="$STATE_DIR/responses.json"
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
  rm -f "$STATE_FILE" "$RESPONSES_FILE"
  rmdir "$STATE_DIR" 2>/dev/null || true
  exit 0
fi

DECISION=$(echo "$RESULT" | jq -r '.decision // ""')

if [ "$DECISION" = "allow" ]; then
  # Approved — clean up branch state dir and allow commit
  rm -rf "$STATE_DIR"
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Code review approved via DiffLoop"
    }
  }'
  exit 0
elif [ "$DECISION" = "save" ]; then
  # Saved — persist state, block commit with short message (no feedback)
  echo "$RESULT" | jq '{state: .state}' > "$STATE_FILE"
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "DiffLoop: Review saved — commit deferred. Resume by running git commit again."
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
