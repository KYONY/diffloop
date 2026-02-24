import { readFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const ROOT = import.meta.dir;
const DIST = join(ROOT, "dist");
const UI = join(ROOT, "src", "ui");

mkdirSync(DIST, { recursive: true });

// Bundle the app TSX into a single JS string
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

// Read CSS
const appCss = readFileSync(join(UI, "styles.css"), "utf-8");

// Read diff2html CSS
const diff2htmlCssPath = resolve(
  ROOT,
  "node_modules/diff2html/bundles/css/diff2html.min.css"
);
const diff2htmlCss = readFileSync(diff2htmlCssPath, "utf-8");

// Read HTML template
const htmlTemplate = readFileSync(join(UI, "index.html"), "utf-8");

// Inject everything
const finalHtml = htmlTemplate
  .replace("/* __STYLES__ */", diff2htmlCss + "\n" + appCss)
  .replace("/* __SCRIPT__ */", jsCode);

const outPath = join(DIST, "index.html");
Bun.write(outPath, finalHtml);

const sizeKb = (new Blob([finalHtml]).size / 1024).toFixed(1);
console.log(`Built: ${outPath} (${sizeKb} KB)`);
