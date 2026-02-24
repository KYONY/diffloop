import { useState, useEffect, useRef } from "preact/hooks";
import * as Diff2Html from "diff2html";
import type {
  DiffData,
  ReviewState,
  Thread,
  CommentType,
} from "../../shared/types.ts";
import { CommentForm } from "./CommentForm.tsx";
import { CommentThread } from "./CommentThread.tsx";

interface Props {
  diffData: DiffData;
  state: ReviewState;
  onStateChange: (s: ReviewState) => void;
}

type ViewMode = "side-by-side" | "unified";

interface CommentTarget {
  file: string;
  line: number;
  side: "old" | "new";
  rowEl: HTMLElement;
}

export function DiffView({ diffData, state, onStateChange }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("side-by-side");
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(
    null
  );
  const diffRef = useRef<HTMLDivElement>(null);

  const outputFormat =
    viewMode === "side-by-side" ? "side-by-side" : "line-by-line";

  const html = Diff2Html.html(diffData.rawUnifiedDiff, {
    drawFileList: true,
    matching: "lines",
    outputFormat,
    renderNothingWhenEmpty: false,
  });

  // After rendering, attach click handlers to line numbers
  useEffect(() => {
    const container = diffRef.current;
    if (!container) return;

    const rows = container.querySelectorAll(
      ".d2h-code-linenumber"
    ) as NodeListOf<HTMLElement>;

    for (const row of rows) {
      // Skip if already has button
      if (row.querySelector(".add-comment-btn")) continue;

      const btn = document.createElement("button");
      btn.className = "add-comment-btn";
      btn.textContent = "+";
      btn.title = "Add comment";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const lineNum = extractLineNumber(row);
        const file = findFileForRow(row);
        const side = row.classList.contains("d2h-code-side-linenumber")
          ? detectSide(row)
          : "new";

        if (file && lineNum > 0) {
          setCommentTarget({
            file,
            line: lineNum,
            side,
            rowEl: row.closest("tr") ?? row,
          });
        }
      });

      row.style.position = "relative";
      row.appendChild(btn);
    }
  }, [html]);

  function addThread(text: string, type: CommentType) {
    if (!commentTarget) return;

    const thread: Thread = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file: commentTarget.file,
      line: commentTarget.line,
      side: commentTarget.side,
      type,
      messages: [{ author: "user", text, timestamp: Date.now() }],
      resolved: false,
    };

    onStateChange({
      ...state,
      threads: [...state.threads, thread],
    });
    setCommentTarget(null);
  }

  function resolveThread(id: string) {
    onStateChange({
      ...state,
      threads: state.threads.map((t) =>
        t.id === id ? { ...t, resolved: true } : t
      ),
    });
  }

  function unresolveThread(id: string) {
    onStateChange({
      ...state,
      threads: state.threads.map((t) =>
        t.id === id ? { ...t, resolved: false } : t
      ),
    });
  }

  // Group threads by file
  const threadsByFile = new Map<string, Thread[]>();
  for (const t of state.threads) {
    const arr = threadsByFile.get(t.file) ?? [];
    arr.push(t);
    threadsByFile.set(t.file, arr);
  }

  return (
    <div class="diff-container">
      <div class="diff-controls">
        <button
          class={viewMode === "side-by-side" ? "active" : ""}
          onClick={() => setViewMode("side-by-side")}
        >
          Side by side
        </button>
        <button
          class={viewMode === "unified" ? "active" : ""}
          onClick={() => setViewMode("unified")}
        >
          Unified
        </button>
      </div>

      <div class="diff-output" ref={diffRef}>
        <div dangerouslySetInnerHTML={{ __html: html }} />

        {/* Inline comment form */}
        {commentTarget && (
          <div class="inline-comment-form">
            <div class="inline-comment-location">
              {commentTarget.file}:{commentTarget.line}
            </div>
            <CommentForm
              onSubmit={addThread}
              onCancel={() => setCommentTarget(null)}
            />
          </div>
        )}
      </div>

      {/* Thread panel */}
      {state.threads.length > 0 && (
        <div class="threads-panel">
          <h3>Comments ({state.threads.filter((t) => !t.resolved).length} open)</h3>
          {state.threads
            .sort((a, b) => {
              // Open threads first
              if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
              return a.file.localeCompare(b.file) || a.line - b.line;
            })
            .map((thread) => (
              <CommentThread
                key={thread.id}
                thread={thread}
                onResolve={resolveThread}
                onUnresolve={unresolveThread}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function extractLineNumber(el: HTMLElement): number {
  const text = el.textContent?.trim() ?? "";
  const num = parseInt(text, 10);
  return isNaN(num) ? 0 : num;
}

function findFileForRow(el: HTMLElement): string {
  // Walk up to find the file header
  let node: HTMLElement | null = el;
  while (node) {
    if (node.classList?.contains("d2h-file-wrapper")) {
      const header = node.querySelector(".d2h-file-name");
      return header?.textContent?.trim() ?? "";
    }
    node = node.parentElement;
  }
  return "";
}

function detectSide(el: HTMLElement): "old" | "new" {
  // In side-by-side, left panel is old, right is new
  const cell = el.closest("td");
  if (!cell) return "new";
  const row = cell.closest("tr");
  if (!row) return "new";
  const cells = Array.from(row.querySelectorAll("td"));
  const idx = cells.indexOf(cell);
  // First half of cells = old side, second half = new side
  return idx < cells.length / 2 ? "old" : "new";
}
