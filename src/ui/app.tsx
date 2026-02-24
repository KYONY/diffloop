import { render } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import type { DiffData, ReviewState } from "../shared/types.ts";
import { DiffView } from "./components/DiffView.tsx";
import { FileTree } from "./components/FileTree.tsx";
import { Toolbar } from "./components/Toolbar.tsx";

function App() {
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/diff").then((r) => r.json() as Promise<DiffData>),
      fetch("/api/state").then((r) => r.json() as Promise<ReviewState>),
    ]).then(([diff, reviewState]) => {
      setDiffData(diff);
      setState(reviewState);
      setLoading(false);
    });
  }, []);

  const handleFileClick = useCallback((filename: string) => {
    setActiveFile(filename);
    // Scroll the diff container to the file's diff section
    const diffContainer = document.querySelector(".diff-container");
    if (!diffContainer) return;

    const fileHeaders = diffContainer.querySelectorAll(".d2h-file-name");
    for (const header of fileHeaders) {
      if (header.textContent?.trim() === filename) {
        const wrapper = header.closest(".d2h-file-wrapper");
        if (wrapper) {
          const containerTop = diffContainer.getBoundingClientRect().top;
          const wrapperTop = wrapper.getBoundingClientRect().top;
          diffContainer.scrollBy({
            top: wrapperTop - containerTop,
            behavior: "smooth",
          });
        }
        break;
      }
    }
  }, []);

  if (loading || !diffData || !state) {
    return <div class="loading">Loading diffs...</div>;
  }

  if (diffData.files.length === 0) {
    return (
      <div class="empty">
        <h1>diffloop</h1>
        <p>No changes detected.</p>
        <Toolbar state={state} onStateChange={setState} />
      </div>
    );
  }

  return (
    <div class="app">
      <header class="header">
        <h1>diffloop</h1>
        <span class="iteration">Iteration {state.iteration}</span>
        <span class="file-count">{diffData.files.length} file(s)</span>
      </header>
      <div class="main-layout">
        <FileTree
          files={diffData.files}
          activeFile={activeFile}
          threads={state.threads}
          onFileClick={handleFileClick}
        />
        <DiffView diffData={diffData} state={state} onStateChange={setState} />
      </div>
      <Toolbar state={state} onStateChange={setState} />
    </div>
  );
}

render(<App />, document.getElementById("app")!);
