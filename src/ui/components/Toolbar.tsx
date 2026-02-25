import { useState } from "preact/hooks";
import type { ReviewState } from "../../shared/types.ts";

interface Props {
  state: ReviewState;
  onStateChange: (s: ReviewState) => void;
}

export function Toolbar({ state }: Props) {
  const openThreads = state.threads.filter((t) => !t.resolved).length;
  const resolvedThreads = state.threads.filter((t) => t.resolved).length;
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleCommit() {
    if (openThreads > 0) {
      setShowConfirm(true);
      return;
    }
    await doCommit();
  }

  async function doCommit() {
    await fetch("/api/approve", { method: "POST" });
    window.close();
  }

  async function handleSubmit() {
    const feedback = formatFeedback(state);
    await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback, state }),
    });
    window.close();
  }

  async function handleSave() {
    await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    window.close();
  }

  return (
    <div class="toolbar">
      <div class="toolbar-stats">
        {openThreads > 0 && (
          <span class="stat open">{openThreads} open</span>
        )}
        {resolvedThreads > 0 && (
          <span class="stat resolved">{resolvedThreads} resolved</span>
        )}
      </div>
      <div class="toolbar-actions">
        <button class="btn btn-save" onClick={handleSave}>
          Save & Close
        </button>
        <button class="btn btn-submit" onClick={handleSubmit}>
          Submit Review
          {openThreads > 0 && ` (${openThreads})`}
        </button>
        <button class="btn btn-approve" onClick={handleCommit}>
          Commit
        </button>
      </div>

      {showConfirm && (
        <div class="confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div class="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="confirm-title">Unresolved threads</div>
            <div class="confirm-message">
              There {openThreads === 1 ? "is" : "are"}{" "}
              <strong>{openThreads}</strong> unresolved thread
              {openThreads === 1 ? "" : "s"}. Continue with commit?
            </div>
            <div class="confirm-actions">
              <button
                class="btn btn-cancel"
                onClick={() => setShowConfirm(false)}
              >
                Keep reviewing
              </button>
              <button class="btn btn-approve" onClick={doCommit}>
                Commit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatFeedback(state: ReviewState): string {
  const open = state.threads.filter((t) => !t.resolved);
  if (open.length === 0) return "No comments.";

  const fixes = open.filter((t) => t.type === "fix");
  const questions = open.filter((t) => t.type === "question");

  let md = "## Code Review Feedback\n\n";

  if (fixes.length > 0) {
    md += "### Fix Requests\n";
    for (const t of fixes) {
      const lastMsg = t.messages[t.messages.length - 1];
      md += `- **${t.file}:${t.line}** — ${lastMsg?.text ?? ""}\n`;
    }
    md += "\n";
  }

  if (questions.length > 0) {
    md += "### Questions\n";
    for (const t of questions) {
      const lastMsg = t.messages[t.messages.length - 1];
      md += `- **${t.file}:${t.line}** — ${lastMsg?.text ?? ""}\n`;
    }
    md += "\n";
  }

  return md;
}
