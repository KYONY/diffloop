import { useState, useRef } from "preact/hooks";
import type { Thread, CommentType } from "../../shared/types.ts";
import { MessageText } from "./MessageText.tsx";
import { MarkdownToolbar } from "./MarkdownToolbar.tsx";

interface Props {
  thread: Thread;
  onSave: (thread: Thread) => void;
  onDelete: (threadId: string) => void;
  onResolve: (threadId: string) => void;
  onCancel: () => void;
}

export function ThreadEditor({ thread, onSave, onDelete, onResolve, onCancel }: Props) {
  const hasAgentResponse = thread.messages.some((m) => m.author === "model");

  // If agent responded: all messages are read-only quotes, form is for NEW reply
  // If no agent response yet: last user message is editable in form
  const lastUserMsg = !hasAgentResponse
    ? [...thread.messages].reverse().find((m) => m.author === "user")
    : null;

  const [text, setText] = useState(lastUserMsg?.text ?? "");
  const [type, setType] = useState<CommentType>(thread.type);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Messages to show as read-only quotes
  const quotedMessages = hasAgentResponse
    ? thread.messages // all messages as quotes
    : thread.messages.filter((m) => m !== lastUserMsg); // all except editable

  function handleSave(e: Event) {
    e.preventDefault();
    if (!text.trim()) return;

    if (hasAgentResponse) {
      // Add new user message to the thread
      const newMsg = { author: "user" as const, text: text.trim(), timestamp: Date.now() };
      onSave({ ...thread, type, messages: [...thread.messages, newMsg] });
    } else {
      // Edit existing user message
      const updatedMessages = thread.messages.map((m) =>
        m === lastUserMsg ? { ...m, text: text.trim() } : m
      );
      onSave({ ...thread, type, messages: updatedMessages });
    }
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
        {thread.file}:{thread.line}
        {thread.endLine && thread.endLine !== thread.line ? `-${thread.endLine}` : ""}
      </div>

      {/* Sequential conversation as marked quotes */}
      {quotedMessages.length > 0 && (
        <div class="thread-conversation">
          {quotedMessages.map((msg, i) => (
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
          ))}
        </div>
      )}

      {/* Form: new reply (if agent responded) or edit (if no response yet) */}
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
          <MarkdownToolbar textareaRef={textareaRef} text={text} setText={setText} />
        </div>
        <textarea
          ref={textareaRef}
          class="comment-textarea"
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          placeholder={hasAgentResponse ? "Reply or resolve..." : "Describe what should be changed..."}
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
