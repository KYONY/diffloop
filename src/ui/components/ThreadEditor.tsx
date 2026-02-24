import { useState } from "preact/hooks";
import type { Thread, CommentType } from "../../shared/types.ts";

interface Props {
  thread: Thread;
  onSave: (thread: Thread) => void;
  onDelete: (threadId: string) => void;
  onCancel: () => void;
}

export function ThreadEditor({ thread, onSave, onDelete, onCancel }: Props) {
  const lastUserMsg = [...thread.messages]
    .reverse()
    .find((m) => m.author === "user");
  const [text, setText] = useState(lastUserMsg?.text ?? "");
  const [type, setType] = useState<CommentType>(thread.type);

  function handleSave(e: Event) {
    e.preventDefault();
    if (!text.trim()) return;

    // Update the last user message text and type
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
            <div class="message-text">{msg.text}</div>
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
        </div>
        <textarea
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
