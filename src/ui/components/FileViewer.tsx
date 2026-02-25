import { useState, useEffect, useRef } from "preact/hooks";

interface Props {
  path: string;
  onClose: () => void;
}

export function FileViewer({ path, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/file?path=${encodeURIComponent(path)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`File not found: ${path}`);
        return r.json();
      })
      .then((data: { content: string }) => setContent(data.content))
      .catch((e: Error) => setError(e.message));
  }, [path]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const lines = content?.split("\n") ?? [];

  return (
    <div class="file-viewer-overlay" onClick={handleOverlayClick}>
      <div class="file-viewer-panel" ref={panelRef}>
        <div class="file-viewer-header">
          <span class="file-viewer-path">{path}</span>
          <span class="file-viewer-line-count">
            {content !== null ? `${lines.length} lines` : ""}
          </span>
          <button class="file-viewer-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div class="file-viewer-content">
          {error && <div class="file-viewer-error">{error}</div>}
          {content === null && !error && (
            <div class="file-viewer-loading">Loading...</div>
          )}
          {content !== null && (
            <table class="file-viewer-table">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td class="file-viewer-linenum">{i + 1}</td>
                    <td class="file-viewer-code">{line || "\n"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
