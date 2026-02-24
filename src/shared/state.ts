import type { ReviewState, StdinInput, Thread } from "./types.ts";

function formatThreadLocation(t: Thread): string {
  if (t.lines && t.lines.length > 0) {
    const sorted = [...t.lines].sort((a, b) => a - b);
    const groups: string[] = [];
    let start = sorted[0]!;
    let end = start;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i]!;
      } else {
        groups.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i]!;
        end = start;
      }
    }
    groups.push(start === end ? `${start}` : `${start}-${end}`);
    return `${t.file}:${groups.join(",")}`;
  }
  if (t.endLine) return `${t.file}:${t.line}-${t.endLine}`;
  return `${t.file}:${t.line}`;
}

export function buildState(input: StdinInput): ReviewState {
  const prev = input.state ?? { iteration: 0, threads: [] };

  // Apply model responses to existing threads
  if (input.modelResponses) {
    for (const resp of input.modelResponses) {
      const thread = prev.threads.find((t) => t.id === resp.threadId);
      if (thread) {
        thread.messages.push({
          author: "model",
          text: resp.text,
          timestamp: Date.now(),
        });
      }
    }
  }

  return {
    iteration: prev.iteration + 1,
    threads: prev.threads,
  };
}

export function formatFeedback(state: ReviewState): string {
  const open = state.threads.filter((t) => !t.resolved);
  if (open.length === 0) return "No comments.";

  const fixes = open.filter((t) => t.type === "fix");
  const questions = open.filter((t) => t.type === "question");

  let md = "## Code Review Feedback\n\n";

  if (fixes.length > 0) {
    md += "### Fix Requests\n";
    for (const t of fixes) {
      const lastMsg = t.messages[t.messages.length - 1];
      md += `- **${formatThreadLocation(t)}** — ${lastMsg?.text ?? ""}\n`;
    }
    md += "\n";
  }

  if (questions.length > 0) {
    md += "### Questions\n";
    for (const t of questions) {
      const lastMsg = t.messages[t.messages.length - 1];
      md += `- **${formatThreadLocation(t)}** — ${lastMsg?.text ?? ""}\n`;
    }
    md += "\n";
  }

  return md;
}
