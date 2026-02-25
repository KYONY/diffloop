import { useState, useRef } from "preact/hooks";
import type { CommentType } from "../../shared/types.ts";

interface Props {
  onSubmit: (text: string, type: CommentType) => void;
  onCancel: () => void;
}

export function CommentForm({ onSubmit, onCancel }: Props) {
  const [text, setText] = useState("");
  const [type, setType] = useState<CommentType>("fix");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim(), type);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
    if (e.key === "Escape") {
      onCancel();
    }
  }

  function insertCodeBlock() {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);

    const before = text.slice(0, start);
    const after = text.slice(end);

    if (selected) {
      const newText = `${before}\`\`\`\n${selected}\n\`\`\`${after}`;
      setText(newText);
    } else {
      const newText = `${before}\`\`\`\n\n\`\`\`${after}`;
      setText(newText);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
        ta.focus();
      }, 0);
    }
  }

  function insertBold() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    const before = text.slice(0, start);
    const after = text.slice(end);
    const newText = selected
      ? `${before}**${selected}**${after}`
      : `${before}****${after}`;
    setText(newText);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = selected ? end + 4 : start + 2;
      ta.focus();
    }, 0);
  }

  function insertInlineCode() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    const before = text.slice(0, start);
    const after = text.slice(end);
    const newText = selected
      ? `${before}\`${selected}\`${after}`
      : `${before}\`\`${after}`;
    setText(newText);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = selected ? end + 2 : start + 1;
      ta.focus();
    }, 0);
  }

  return (
    <form class="comment-form" onSubmit={handleSubmit}>
      <div class="comment-form-toolbar">
        <div class="comment-form-type">
          <button
            type="button"
            class={`type-btn ${type === "fix" ? "active" : ""}`}
            onClick={() => setType("fix")}
            title="Request a code fix"
          >
            Fix
          </button>
          <button
            type="button"
            class={`type-btn ${type === "question" ? "active" : ""}`}
            onClick={() => setType("question")}
            title="Ask a question"
          >
            Question
          </button>
        </div>
        <div class="comment-form-md-tools">
          <button
            type="button"
            class="md-tool-btn"
            onClick={insertBold}
            title="Bold (**text**)"
          >
            B
          </button>
          <button
            type="button"
            class="md-tool-btn"
            onClick={insertInlineCode}
            title="Inline code (`code`)"
          >
            {"<>"}
          </button>
          <button
            type="button"
            class="md-tool-btn"
            onClick={insertCodeBlock}
            title="Code block (```code```)"
          >
            {"</>"}
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        class="comment-textarea"
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown={handleKeyDown}
        placeholder={
          type === "fix"
            ? "Describe what should be changed..."
            : "Ask your question..."
        }
        rows={3}
        autoFocus
      />
      <div class="comment-form-actions">
        <span class="hint">Ctrl+Enter to submit, Esc to cancel</span>
        <button type="button" class="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" class="btn-comment" disabled={!text.trim()}>
          Comment
        </button>
      </div>
    </form>
  );
}
