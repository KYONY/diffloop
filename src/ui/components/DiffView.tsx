import { useState, useEffect, useRef } from "preact/hooks";
import { render as preactRender } from "preact";
import * as Diff2Html from "diff2html";
import type {
  DiffData,
  ReviewState,
  Thread,
  CommentType,
} from "../../shared/types.ts";
import { CommentForm } from "./CommentForm.tsx";
import { CommentThread } from "./CommentThread.tsx";
import { ThreadEditor } from "./ThreadEditor.tsx";

interface Props {
  diffData: DiffData;
  state: ReviewState;
  onStateChange: (s: ReviewState) => void;
}

type ViewMode = "side-by-side" | "unified";

interface CommentTarget {
  file: string;
  lines: number[];
  side: "old" | "new";
}

const SELECTED_LINE_CLASS = "diffloop-line-selected";
const COMMENTED_LINE_CLASS = "diffloop-line-commented";
const COMMENT_INDICATOR_CLASS = "diffloop-comment-indicator";

/** Format lines like: 5, 8, 12-15 */
function formatLines(lines: number[]): string {
  if (lines.length === 0) return "";
  const sorted = [...lines].sort((a, b) => a - b);
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
  return groups.join(", ");
}

const DRAG_HIGHLIGHT_CLASS = "diffloop-line-drag-preview";

export function DiffView({ diffData, state, onStateChange }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("unified");
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(
    null
  );
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const diffRef = useRef<HTMLDivElement>(null);
  const formContainerRef = useRef<HTMLElement | null>(null);
  const editorContainerRef = useRef<HTMLElement | null>(null);

  // Drag state (refs to avoid re-renders during drag)
  const dragRef = useRef<{
    active: boolean;
    anchor: number;
    current: number;
    file: string;
    side: "old" | "new";
    fileWrapper: HTMLElement;
  } | null>(null);

  const outputFormat =
    viewMode === "side-by-side" ? "side-by-side" : "line-by-line";

  const html = Diff2Html.html(diffData.rawUnifiedDiff, {
    drawFileList: false,
    matching: "lines",
    outputFormat,
    renderNothingWhenEmpty: false,
  });

  // Update drag preview highlights (no React state, direct DOM)
  function updateDragPreview() {
    const container = diffRef.current;
    if (!container) return;

    // Clear old preview
    container
      .querySelectorAll(`.${DRAG_HIGHLIGHT_CLASS}`)
      .forEach((el) => el.classList.remove(DRAG_HIGHLIGHT_CLASS));

    const drag = dragRef.current;
    if (!drag || !drag.active) return;

    const start = Math.min(drag.anchor, drag.current);
    const end = Math.max(drag.anchor, drag.current);
    const range: number[] = [];
    for (let i = start; i <= end; i++) range.push(i);

    const rows = getRowsByLines(drag.fileWrapper, range);
    for (const row of rows) {
      row.classList.add(DRAG_HIGHLIGHT_CLASS);
    }
  }

  // Attach mousedown + mouseover + mouseup for drag selection
  useEffect(() => {
    const container = diffRef.current;
    if (!container) return;

    const lineNumCells = container.querySelectorAll(
      ".d2h-code-linenumber"
    ) as NodeListOf<HTMLElement>;

    for (const cell of lineNumCells) {
      if (cell.dataset.diffloopBound) continue;
      cell.dataset.diffloopBound = "1";

      cell.style.userSelect = "none";
      cell.style.cursor = "pointer";
      cell.style.position = "relative";

      // Add "+" indicator
      const btn = document.createElement("span");
      btn.className = "add-comment-btn";
      btn.textContent = "+";
      cell.appendChild(btn);

      // mousedown: start drag or ctrl+toggle
      cell.addEventListener("mousedown", (e) => {
        e.preventDefault(); // prevent text selection always

        const lineNum = extractLineNumber(cell);
        const file = findFileForRow(cell);
        if (!file || lineNum <= 0) return;

        const side = cell.classList.contains("d2h-code-side-linenumber")
          ? detectSide(cell)
          : "new";

        // Ctrl+click: toggle individual line immediately
        if (e.ctrlKey || e.metaKey) {
          setCommentTarget((prev) => {
            if (prev && prev.file === file && prev.side === side) {
              const has = prev.lines.includes(lineNum);
              const newLines = has
                ? prev.lines.filter((l) => l !== lineNum)
                : [...prev.lines, lineNum];
              if (newLines.length === 0) return null;
              return { file, lines: newLines, side };
            }
            return { file, lines: [lineNum], side };
          });
          return;
        }

        // Start drag
        const fileWrapper = findFileWrapper(container, file);
        if (!fileWrapper) return;

        dragRef.current = {
          active: true,
          anchor: lineNum,
          current: lineNum,
          file,
          side,
          fileWrapper,
        };
        updateDragPreview();
      });

      // mouseover: extend drag if active
      cell.addEventListener("mouseenter", () => {
        const drag = dragRef.current;
        if (!drag || !drag.active) return;

        const lineNum = extractLineNumber(cell);
        const file = findFileForRow(cell);
        if (!file || lineNum <= 0 || file !== drag.file) return;

        drag.current = lineNum;
        updateDragPreview();
      });
    }

    // mouseup anywhere: finalize drag
    function onMouseUp() {
      const drag = dragRef.current;
      if (!drag || !drag.active) return;

      drag.active = false;

      // Clear drag preview
      container
        .querySelectorAll(`.${DRAG_HIGHLIGHT_CLASS}`)
        .forEach((el) => el.classList.remove(DRAG_HIGHLIGHT_CLASS));

      const start = Math.min(drag.anchor, drag.current);
      const end = Math.max(drag.anchor, drag.current);
      const range: number[] = [];
      for (let i = start; i <= end; i++) range.push(i);

      setCommentTarget({ file: drag.file, lines: range, side: drag.side });
      dragRef.current = null;
    }

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [html]);

  // Render inline comment form after the last selected row
  useEffect(() => {
    // Clean up previous form container
    if (formContainerRef.current) {
      preactRender(null, formContainerRef.current);
      formContainerRef.current.remove();
      formContainerRef.current = null;
    }

    // Clear selection highlights
    const container = diffRef.current;
    if (container) {
      container
        .querySelectorAll(`.${SELECTED_LINE_CLASS}`)
        .forEach((el) => el.classList.remove(SELECTED_LINE_CLASS));
    }

    if (!commentTarget || !container) return;

    const fileWrapper = findFileWrapper(container, commentTarget.file);
    if (!fileWrapper) return;

    // Highlight selected rows
    const selectedRows = getRowsByLines(fileWrapper, commentTarget.lines);
    for (const row of selectedRows) {
      row.classList.add(SELECTED_LINE_CLASS);
    }

    // Insert form after the last selected row (by max line number)
    const maxLine = Math.max(...commentTarget.lines);
    const lastRows = getRowsByLines(fileWrapper, [maxLine]);
    const lastRow = lastRows[lastRows.length - 1];
    if (!lastRow) return;

    const tr = document.createElement("tr");
    tr.className = "diffloop-inline-form-row";
    const td = document.createElement("td");
    td.colSpan = 20;
    td.className = "diffloop-inline-form-cell";
    tr.appendChild(td);

    lastRow.after(tr);
    formContainerRef.current = td;

    const locationText = `${commentTarget.file}:${formatLines(commentTarget.lines)}`;

    preactRender(
      <div class="inline-comment-form">
        <div class="inline-comment-location">{locationText}</div>
        <CommentForm
          onSubmit={(text: string, type: CommentType) => {
            addThread(text, type);
          }}
          onCancel={() => {
            setCommentTarget(null);
          }}
        />
      </div>,
      td
    );

    tr.scrollIntoView({ behavior: "smooth", block: "nearest" });

    return () => {
      if (formContainerRef.current) {
        preactRender(null, formContainerRef.current);
        formContainerRef.current.remove();
        formContainerRef.current = null;
      }
    };
  }, [commentTarget]);

  // File collapse: click on file header to toggle
  useEffect(() => {
    const container = diffRef.current;
    if (!container) return;

    const fileHeaders = container.querySelectorAll(
      ".d2h-file-header"
    ) as NodeListOf<HTMLElement>;

    for (const header of fileHeaders) {
      if (header.dataset.diffloopCollapse) continue;
      header.dataset.diffloopCollapse = "1";
      header.style.cursor = "pointer";
      header.style.userSelect = "none";

      header.addEventListener("click", () => {
        const wrapper = header.closest(".d2h-file-wrapper") as HTMLElement | null;
        if (!wrapper) return;

        const diffBody = wrapper.querySelector(
          ".d2h-diff-table, .d2h-files-diff"
        ) as HTMLElement | null;
        if (!diffBody) return;

        const isCollapsed = diffBody.style.display === "none";
        diffBody.style.display = isCollapsed ? "" : "none";

        // Toggle collapsed class for styling
        wrapper.classList.toggle("diffloop-file-collapsed", !isCollapsed);

        // Update or create collapse indicator
        let chevron = header.querySelector(".diffloop-collapse-chevron") as HTMLElement | null;
        if (!chevron) {
          chevron = document.createElement("span");
          chevron.className = "diffloop-collapse-chevron";
          header.insertBefore(chevron, header.firstChild);
        }
        chevron.textContent = isCollapsed ? "\u25BE " : "\u25B8 ";
      });

      // Add initial chevron
      const chevron = document.createElement("span");
      chevron.className = "diffloop-collapse-chevron";
      chevron.textContent = "\u25BE ";
      header.insertBefore(chevron, header.firstChild);
    }
  }, [html]);

  // Add comment badges to collapsed file headers
  useEffect(() => {
    const container = diffRef.current;
    if (!container) return;

    // Clear old badges
    container
      .querySelectorAll(".diffloop-file-comment-badge")
      .forEach((el) => el.remove());

    // Count open threads per file
    const openByFile = new Map<string, number>();
    for (const t of state.threads) {
      if (t.resolved) continue;
      openByFile.set(t.file, (openByFile.get(t.file) ?? 0) + 1);
    }

    const fileHeaders = container.querySelectorAll(
      ".d2h-file-header"
    ) as NodeListOf<HTMLElement>;

    for (const header of fileHeaders) {
      const nameEl = header.querySelector(".d2h-file-name");
      const filename = nameEl?.textContent?.trim() ?? "";
      const count = openByFile.get(filename);
      if (!count) continue;

      const badge = document.createElement("span");
      badge.className = "diffloop-file-comment-badge";
      badge.textContent = `\uD83D\uDCAC ${count}`;
      badge.title = `${count} open comment(s)`;
      header.appendChild(badge);
    }
  }, [html, state.threads]);

  // Mark lines that have comments
  useEffect(() => {
    const container = diffRef.current;
    if (!container) return;

    container
      .querySelectorAll(`.${COMMENTED_LINE_CLASS}`)
      .forEach((el) => el.classList.remove(COMMENTED_LINE_CLASS));
    container
      .querySelectorAll(`.${COMMENT_INDICATOR_CLASS}`)
      .forEach((el) => el.remove());

    for (const thread of state.threads) {
      if (thread.resolved) continue;

      const fileWrapper = findFileWrapper(container, thread.file);
      if (!fileWrapper) continue;

      const threadLines = thread.lines ?? [thread.line];
      const rows = getRowsByLines(fileWrapper, threadLines);

      for (const row of rows) {
        row.classList.add(COMMENTED_LINE_CLASS);
      }

      const firstRow = rows[0];
      if (!firstRow) continue;
      const lineCell = firstRow.querySelector(
        ".d2h-code-linenumber"
      ) as HTMLElement | null;
      if (
        !lineCell ||
        lineCell.querySelector(`.${COMMENT_INDICATOR_CLASS}`)
      )
        continue;

      const indicator = document.createElement("span");
      indicator.className = COMMENT_INDICATOR_CLASS;
      indicator.textContent = "\uD83D\uDCAC";
      indicator.title = `Click to edit — ${thread.type === "fix" ? "Fix" : "Question"}: ${thread.messages[0]?.text.slice(0, 60) ?? ""}`;
      indicator.style.cursor = "pointer";
      indicator.style.pointerEvents = "auto";
      indicator.dataset.threadId = thread.id;
      indicator.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        setCommentTarget(null); // close new comment form if open
        setEditingThreadId(thread.id);
      });
      lineCell.style.position = "relative";
      lineCell.appendChild(indicator);
    }
  }, [html, state.threads]);

  // Render inline thread editor when editing
  useEffect(() => {
    // Clean up previous editor
    if (editorContainerRef.current) {
      preactRender(null, editorContainerRef.current);
      editorContainerRef.current.remove();
      editorContainerRef.current = null;
    }

    if (!editingThreadId) return;

    const container = diffRef.current;
    if (!container) return;

    const thread = state.threads.find((t) => t.id === editingThreadId);
    if (!thread) {
      setEditingThreadId(null);
      return;
    }

    const fileWrapper = findFileWrapper(container, thread.file);
    if (!fileWrapper) return;

    const threadLines = thread.lines ?? [thread.line];
    const maxLine = Math.max(...threadLines);
    const lastRows = getRowsByLines(fileWrapper, [maxLine]);
    const lastRow = lastRows[lastRows.length - 1];
    if (!lastRow) return;

    const tr = document.createElement("tr");
    tr.className = "diffloop-inline-form-row";
    const td = document.createElement("td");
    td.colSpan = 20;
    td.className = "diffloop-inline-form-cell";
    tr.appendChild(td);

    lastRow.after(tr);
    editorContainerRef.current = td;

    preactRender(
      <ThreadEditor
        thread={thread}
        onSave={(updated) => {
          onStateChange({
            ...state,
            threads: state.threads.map((t) =>
              t.id === updated.id ? updated : t
            ),
          });
          setEditingThreadId(null);
        }}
        onDelete={(id) => {
          onStateChange({
            ...state,
            threads: state.threads.filter((t) => t.id !== id),
          });
          setEditingThreadId(null);
        }}
        onCancel={() => setEditingThreadId(null)}
      />,
      td
    );

    tr.scrollIntoView({ behavior: "smooth", block: "nearest" });

    return () => {
      if (editorContainerRef.current) {
        preactRender(null, editorContainerRef.current);
        editorContainerRef.current.remove();
        editorContainerRef.current = null;
      }
    };
  }, [editingThreadId, state.threads]);

  function addThread(text: string, type: CommentType) {
    if (!commentTarget) return;

    const sorted = [...commentTarget.lines].sort((a, b) => a - b);

    const thread: Thread = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file: commentTarget.file,
      line: sorted[0]!,
      lines: sorted,
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

  return (
    <div class="diff-container">
      <div class="diff-controls">
        <button
          class={viewMode === "unified" ? "active" : ""}
          onClick={() => setViewMode("unified")}
        >
          Unified
        </button>
        <button
          class={viewMode === "side-by-side" ? "active" : ""}
          onClick={() => setViewMode("side-by-side")}
        >
          Side by side
        </button>
      </div>

      <div class="diff-output" ref={diffRef}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      {state.threads.length > 0 && (
        <div class="threads-panel">
          <h3>
            Comments ({state.threads.filter((t) => !t.resolved).length} open)
          </h3>
          {state.threads
            .sort((a, b) => {
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
  const lineNum2 = el.querySelector(".line-num2");
  if (lineNum2) {
    const num = parseInt(lineNum2.textContent?.trim() ?? "", 10);
    if (!isNaN(num)) return num;
  }
  const lineNum1 = el.querySelector(".line-num1");
  if (lineNum1) {
    const num = parseInt(lineNum1.textContent?.trim() ?? "", 10);
    if (!isNaN(num)) return num;
  }
  const text = el.textContent?.trim() ?? "";
  const num = parseInt(text, 10);
  return isNaN(num) ? 0 : num;
}

function findFileForRow(el: HTMLElement): string {
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

function findFileWrapper(
  container: HTMLElement,
  filename: string
): HTMLElement | null {
  const wrappers = container.querySelectorAll(".d2h-file-wrapper");
  for (const wrapper of wrappers) {
    const header = wrapper.querySelector(".d2h-file-name");
    if (header?.textContent?.trim() === filename) {
      return wrapper as HTMLElement;
    }
  }
  return null;
}

function getRowsByLines(
  fileWrapper: HTMLElement,
  lines: number[]
): HTMLElement[] {
  const lineSet = new Set(lines);
  const rows: HTMLElement[] = [];
  const allRows = fileWrapper.querySelectorAll(
    "tr"
  ) as NodeListOf<HTMLElement>;

  for (const row of allRows) {
    const lineCell = row.querySelector(".d2h-code-linenumber");
    if (!lineCell) continue;
    const lineNum = extractLineNumber(lineCell as HTMLElement);
    if (lineSet.has(lineNum)) {
      rows.push(row);
    }
  }
  return rows;
}

function detectSide(el: HTMLElement): "old" | "new" {
  const cell = el.closest("td");
  if (!cell) return "new";
  const row = cell.closest("tr");
  if (!row) return "new";
  const cells = Array.from(row.querySelectorAll("td"));
  const idx = cells.indexOf(cell);
  return idx < cells.length / 2 ? "old" : "new";
}
