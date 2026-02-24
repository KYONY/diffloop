import type { ReviewState } from "../../shared/types.ts";

interface Props {
  state: ReviewState;
  onStateChange: (s: ReviewState) => void;
}

export function Toolbar({ state }: Props) {
  const openThreads = state.threads.filter((t) => !t.resolved).length;
  const resolvedThreads = state.threads.filter((t) => t.resolved).length;

  async function handleApprove() {
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
        <button class="btn btn-submit" onClick={handleSubmit}>
          Submit Review
          {openThreads > 0 && ` (${openThreads})`}
        </button>
        <button class="btn btn-approve" onClick={handleApprove}>
          Approve
        </button>
      </div>
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
