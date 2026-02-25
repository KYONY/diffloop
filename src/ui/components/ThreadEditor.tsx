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

  // Split messages into conversation history (read-only) and editable part
  const userMessages = thread.messages.filter((m) => m.author === "user");
  const modelMessages = thread.messages.filter((m) => m.author === "model");
  const hasConversation = thread.messages.length > 1 || modelMessages.length > 0;

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
    <div class="inline-comment-form">
      <div class="inline-comment-location">
        {thread.file}:{thread.line}
        {thread.endLine && thread.endLine !== thread.line ? `-${thread.endLine}` : ""}
      </div>

      {/* Conversation history */}
      {hasConversation && (
        <div class="thread-conversation">
          {thread.messages.map((msg, i) => {
            // Skip the last user message — it's editable in the form
            if (msg === lastUserMsg && msg.author === "user") return null;
            return (
              <div
                key={i}
                class={`thread-msg ${msg.author === "user" ? "thread-msg-user" : "thread-msg-agent"}`}
              >
                <span class="thread-msg-label">
                  {msg.author === "user" ? "You" : "Agent"}
                </span>
                <div class="thread-msg-body">
                  <MessageText text={msg.text} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editable form */}
      <form class="comment-form" onSubmit={handleSave}>
        <div class="comment-form-toolbar">
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
