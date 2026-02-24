import { readFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const ROOT = import.meta.dir;
const DIST = join(ROOT, "dist");
const UI = join(ROOT, "src", "ui");

mkdirSync(DIST, { recursive: true });

// Bundle the app TSX into a JS file
const appBundle = await Bun.build({
  entrypoints: [join(UI, "app.tsx")],
  minify: true,
  target: "browser",
  format: "esm",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

if (!appBundle.success) {
  console.error("Build failed:");
  for (const log of appBundle.logs) {
    console.error(log);
  }
  process.exit(1);
}

const jsCode = await appBundle.outputs[0]!.text();

// Write JS bundle separately
const jsPath = join(DIST, "app.js");
Bun.write(jsPath, jsCode);

// Read CSS
const appCss = readFileSync(join(UI, "styles.css"), "utf-8");

// Read diff2html CSS
const diff2htmlCssPath = resolve(
  ROOT,
  "node_modules/diff2html/bundles/css/diff2html.min.css"
);
const diff2htmlCss = readFileSync(diff2htmlCssPath, "utf-8");

// Build HTML with CSS inlined, JS loaded externally
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>diffloop</title>
  <style>${diff2htmlCss}\n${appCss}</style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>`;

const htmlPath = join(DIST, "index.html");
Bun.write(htmlPath, html);

const htmlSize = (new Blob([html]).size / 1024).toFixed(1);
const jsSize = (new Blob([jsCode]).size / 1024).toFixed(1);
console.log(`Built: ${htmlPath} (${htmlSize} KB) + app.js (${jsSize} KB)`);
