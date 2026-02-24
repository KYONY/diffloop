import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import type { DiffData, ReviewState } from "../shared/types.ts";
import { DiffView } from "./components/DiffView.tsx";
import { Toolbar } from "./components/Toolbar.tsx";

function App() {
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const [loading, setLoading] = useState(true);

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
      <DiffView diffData={diffData} state={state} onStateChange={setState} />
      <Toolbar state={state} onStateChange={setState} />
    </div>
  );
}

render(<App />, document.getElementById("app")!);
