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

export async function collectDiffs(): Promise<DiffData> {
  const [unstaged, staged] = await Promise.all([
    exec(["git", "diff"]),
    exec(["git", "diff", "--staged"]),
  ]);

  const rawUnifiedDiff = [unstaged, staged].filter(Boolean).join("\n");
  const combined = [unstaged, staged].filter(Boolean).join("\n");
  const files = parseDiffFiles(combined);

  return { files, rawUnifiedDiff };
}

// Exported for testing
export { parseDiffFiles };
