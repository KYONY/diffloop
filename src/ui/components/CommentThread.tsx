import type { Thread } from "../../shared/types.ts";

interface Props {
  thread: Thread;
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
}

export function CommentThread({ thread, onResolve, onUnresolve }: Props) {
  const typeLabel = thread.type === "fix" ? "Fix" : "Question";
  const typeClass = thread.type === "fix" ? "type-fix" : "type-question";

  return (
    <div class={`thread ${thread.resolved ? "thread-resolved" : ""}`}>
      <div class="thread-header">
        <span class={`thread-type ${typeClass}`}>{typeLabel}</span>
        <span class="thread-location">
          {thread.file}:{thread.line}
        </span>
        {thread.resolved ? (
          <button
            class="thread-resolve-btn"
            onClick={() => onUnresolve(thread.id)}
          >
            Reopen
          </button>
        ) : (
          <button
            class="thread-resolve-btn"
            onClick={() => onResolve(thread.id)}
          >
            Resolve
          </button>
        )}
      </div>
      <div class="thread-messages">
        {thread.messages.map((msg, i) => (
          <div
            key={i}
            class={`message ${msg.author === "model" ? "message-model" : "message-user"}`}
          >
            <span class="message-author">
              {msg.author === "model" ? "Agent" : "You"}
            </span>
            <div class="message-text">{msg.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
