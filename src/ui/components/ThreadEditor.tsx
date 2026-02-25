import { useState, useRef } from "preact/hooks";
import type { Thread, CommentType } from "../../shared/types.ts";
import { MessageText } from "./MessageText.tsx";

interface Props {
  thread: Thread;
  onSave: (thread: Thread) => void;
  onDelete: (threadId: string) => void;
  onResolve: (threadId: string) => void;
  onCancel: () => void;
}

export function ThreadEditor({ thread, onSave, onDelete, onResolve, onCancel }: Props) {
  const lastUserMsg = [...thread.messages]
    .reverse()
    .find((m) => m.author === "user");
  const [text, setText] = useState(lastUserMsg?.text ?? "");
  const [type, setType] = useState<CommentType>(thread.type);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSave(e: Event) {
    e.preventDefault();
    if (!text.trim()) return;

    const updatedMessages = thread.messages.map((m) =>
      m === lastUserMsg ? { ...m, text: text.trim() } : m
    );

    onSave({ ...thread, type, messages: updatedMessages });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave(e);
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
      // Position cursor inside the code block
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
        ta.focus();
      }, 0);
    }
  }

  return (
    <div class="inline-comment-form">
      <div class="inline-comment-location">
        Editing comment on {thread.file}
      </div>

      {/* Show model responses (read-only) */}
      {thread.messages
        .filter((m) => m.author === "model")
        .map((msg, i) => (
          <div key={i} class="message message-model" style={{ marginBottom: "8px" }}>
            <span class="message-author">Agent</span>
            <div class="message-text">
              <MessageText text={msg.text} />
            </div>
          </div>
        ))}

      <form class="comment-form" onSubmit={handleSave}>
        <div class="comment-form-type">
          <button
            type="button"
            class={`type-btn ${type === "fix" ? "active" : ""}`}
            onClick={() => setType("fix")}
          >
            Fix
          </button>
          <button
            type="button"
            class={`type-btn ${type === "question" ? "active" : ""}`}
            onClick={() => setType("question")}
          >
            Question
          </button>
          <button
            type="button"
            class="type-btn code-insert-btn"
            onClick={insertCodeBlock}
            title="Insert code block"
          >
            {"</>"}
          </button>
        </div>
        <textarea
          ref={textareaRef}
          class="comment-textarea"
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          rows={3}
          autoFocus
        />
        <div class="comment-form-actions">
          <button
            type="button"
            class="btn-cancel btn-delete"
            onClick={() => onDelete(thread.id)}
          >
            Delete
          </button>
          {!thread.resolved ? (
            <button
              type="button"
              class="btn-resolve"
              onClick={() => onResolve(thread.id)}
            >
              Resolve
            </button>
          ) : (
            <button
              type="button"
              class="btn-cancel"
              onClick={() => onResolve(thread.id)}
            >
              Reopen
            </button>
          )}
          <span class="hint">Ctrl+Enter to save, Esc to cancel</span>
          <button type="button" class="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" class="btn-comment" disabled={!text.trim()}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
