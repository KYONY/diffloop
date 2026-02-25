import type {
  DiffData,
  ReviewState,
  Decision,
} from "../shared/types.ts";

interface ServerOptions {
  diffData: DiffData;
  state: ReviewState;
  branch?: string;
  project?: string;
  htmlContent?: string;
  jsContent?: string;
  port?: number;
}

export function createServer(options: ServerOptions): {
  server: ReturnType<typeof Bun.serve>;
  waitForDecision: () => Promise<Decision>;
} {
  const { diffData, state, branch, project, htmlContent, jsContent, port } = options;

  let resolveDecision: ((d: Decision) => void) | null = null;
  const decisionPromise = new Promise<Decision>((resolve) => {
    resolveDecision = resolve;
  });

  const server = Bun.serve({
    port: port ?? 0,
    fetch(req) {
      const url = new URL(req.url);

      // Serve HTML
      if (url.pathname === "/") {
        const html = htmlContent ?? getFallbackHtml();
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Serve JS bundle
      if (url.pathname === "/app.js" && jsContent) {
        return new Response(jsContent, {
          headers: { "Content-Type": "application/javascript; charset=utf-8" },
        });
      }

      // API: get diffs
      if (url.pathname === "/api/diff" && req.method === "GET") {
        return Response.json(diffData);
      }

      // API: get state (threads, iteration)
      if (url.pathname === "/api/state" && req.method === "GET") {
        return Response.json(state);
      }

      // API: get metadata (branch, project)
      if (url.pathname === "/api/meta" && req.method === "GET") {
        return Response.json({ branch: branch ?? "unknown", project: project ?? "unknown" });
      }

      // API: approve
      if (url.pathname === "/api/approve" && req.method === "POST") {
        resolveDecision?.({ decision: "allow" });
        return Response.json({ ok: true });
      }

      // API: submit review
      if (url.pathname === "/api/submit" && req.method === "POST") {
        return (async () => {
          const body = (await req.json()) as {
            feedback: string;
            state: ReviewState;
          };
          // Save current diff so next iteration can highlight changes
          body.state.previousRawDiff = diffData.rawUnifiedDiff;
          resolveDecision?.({
            decision: "deny",
            feedback: body.feedback,
            state: body.state,
          });
          return Response.json({ ok: true });
        })();
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  return { server, waitForDecision: () => decisionPromise };
}

function getFallbackHtml(): string {
  return `<!DOCTYPE html>
<html><body>
<h1>diffloop</h1>
<p>UI not built yet. Run <code>bun run build</code> first.</p>
<pre id="diff"></pre>
<button onclick="fetch('/api/approve',{method:'POST'}).then(()=>window.close())">Approve</button>
<script>
fetch('/api/diff').then(r=>r.json()).then(d=>{
  document.getElementById('diff').textContent=d.rawUnifiedDiff||'No changes';
});
</script>
</body></html>`;
}
