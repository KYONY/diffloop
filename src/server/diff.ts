import type { FileDiff, DiffData } from "../shared/types.ts";

async function exec(args: string[]): Promise<string> {
  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return output;
}

function parseDiffFiles(rawDiff: string): FileDiff[] {
  if (!rawDiff.trim()) return [];

  const files: FileDiff[] = [];
  const fileDiffs = rawDiff.split(/^(?=diff --git )/m);

  for (const chunk of fileDiffs) {
    if (!chunk.trim()) continue;

    const headerMatch = chunk.match(/^diff --git a\/(.+?) b\/(.+)/m);
    if (!headerMatch) continue;

    const oldName = headerMatch[1]!;
    const newName = headerMatch[2]!;

    let status: FileDiff["status"] = "modified";
    if (chunk.includes("new file mode")) {
      status = "added";
    } else if (chunk.includes("deleted file mode")) {
      status = "deleted";
    } else if (oldName !== newName) {
      status = "renamed";
    }

    files.push({
      filename: newName,
      status,
      oldFilename: status === "renamed" ? oldName : undefined,
      rawDiff: chunk,
    });
  }

  return files;
}

async function getUntrackedDiff(): Promise<string> {
  // Find untracked files (not in .gitignore)
  const output = await exec([
    "git",
    "ls-files",
    "--others",
    "--exclude-standard",
  ]);
  const untrackedFiles = output
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  if (untrackedFiles.length === 0) return "";

  // Generate diff for each untracked file using --no-index
  const diffs: string[] = [];
  for (const file of untrackedFiles) {
    const diff = await exec([
      "git",
      "diff",
      "--no-index",
      "--",
      "/dev/null",
      file,
    ]);
    if (diff.trim()) {
      // Fix the header: --no-index produces "a//dev/null b/file", normalize it
      const fixed = diff
        .replace(/^diff --git a\/\/dev\/null b\/(.+)/m, "diff --git a/$1 b/$1")
        .replace(/^--- a\/\/dev\/null/m, "--- /dev/null");
      diffs.push(fixed);
    }
  }

  return diffs.join("\n");
}

export async function collectDiffs(): Promise<DiffData> {
  const [unstaged, staged, untracked] = await Promise.all([
    exec(["git", "diff"]),
    exec(["git", "diff", "--staged"]),
    getUntrackedDiff(),
  ]);

  const rawUnifiedDiff = [unstaged, staged, untracked]
    .filter(Boolean)
    .join("\n");
  const files = parseDiffFiles(rawUnifiedDiff);

  return { files, rawUnifiedDiff };
}

// Exported for testing
export { parseDiffFiles };
