import { useState, useMemo } from "preact/hooks";
import type { FileDiff, Thread } from "../../shared/types.ts";

interface Props {
  files: FileDiff[];
  activeFile: string | null;
  threads: Thread[];
  onFileClick: (filename: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  file?: FileDiff;
}

function buildTree(files: FileDiff[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map() };

  for (const file of files) {
    const parts = file.filename.split("/");
    let node = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const path = parts.slice(0, i + 1).join("/");

      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path,
          children: new Map(),
        });
      }
      node = node.children.get(part)!;
    }

    node.file = file;
  }

  return root;
}

function statusIcon(status: FileDiff["status"]): string {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "modified":
      return "M";
    case "renamed":
      return "R";
  }
}

function statusClass(status: FileDiff["status"]): string {
  switch (status) {
    case "added":
      return "status-added";
    case "deleted":
      return "status-deleted";
    case "modified":
      return "status-modified";
    case "renamed":
      return "status-renamed";
  }
}

function countChanges(rawDiff: string): { added: number; deleted: number } {
  let added = 0;
  let deleted = 0;
  for (const line of rawDiff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    else if (line.startsWith("-") && !line.startsWith("---")) deleted++;
  }
  return { added, deleted };
}

function TreeItem({
  node,
  depth,
  activeFile,
  commentsByFile,
  onFileClick,
}: {
  node: TreeNode;
  depth: number;
  activeFile: string | null;
  commentsByFile: Map<string, number>;
  onFileClick: (filename: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = node.children.size > 0 && !node.file;
  const isFile = !!node.file;

  const sortedChildren = useMemo(() => {
    const entries = Array.from(node.children.values());
    return entries.sort((a, b) => {
      const aIsDir = a.children.size > 0 && !a.file;
      const bIsDir = b.children.size > 0 && !b.file;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [node.children]);

  if (isDir) {
    return (
      <div class="tree-dir">
        <div
          class="tree-item tree-dir-name"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <span class="tree-arrow">{expanded ? "\u25BE" : "\u25B8"}</span>
          <span class="tree-icon">&#128193;</span>
          <span class="tree-name">{node.name}</span>
        </div>
        {expanded && (
          <div class="tree-children">
            {sortedChildren.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFile={activeFile}
                commentsByFile={commentsByFile}
                onFileClick={onFileClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isFile) {
    const isActive = activeFile === node.file!.filename;
    const changes = useMemo(() => countChanges(node.file!.rawDiff), [node.file]);
    const commentCount = commentsByFile.get(node.file!.filename) ?? 0;

    return (
      <div
        class={`tree-item tree-file ${isActive ? "tree-file-active" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onFileClick(node.file!.filename)}
      >
        <span class={`tree-status ${statusClass(node.file!.status)}`}>
          {statusIcon(node.file!.status)}
        </span>
        <span class="tree-name">{node.name}</span>
        {commentCount > 0 && (
          <span class="tree-comment-badge" title={`${commentCount} open comment(s)`}>
            {"\uD83D\uDCAC"}{commentCount}
          </span>
        )}
        <span class="tree-changes">
          {changes.added > 0 && (
            <span class="tree-additions">+{changes.added}</span>
          )}
          {changes.deleted > 0 && (
            <span class="tree-deletions">-{changes.deleted}</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <>
      {sortedChildren.map((child) => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth}
          activeFile={activeFile}
          commentsByFile={commentsByFile}
          onFileClick={onFileClick}
        />
      ))}
    </>
  );
}

export function FileTree({ files, activeFile, threads, onFileClick }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const tree = useMemo(() => buildTree(files), [files]);

  // Count open comments per file
  const commentsByFile = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of threads) {
      if (t.resolved) continue;
      map.set(t.file, (map.get(t.file) ?? 0) + 1);
    }
    return map;
  }, [threads]);

  const sortedRoots = useMemo(() => {
    const entries = Array.from(tree.children.values());
    return entries.sort((a, b) => {
      const aIsDir = a.children.size > 0 && !a.file;
      const bIsDir = b.children.size > 0 && !b.file;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [tree]);

  return (
    <div class={`file-tree ${collapsed ? "file-tree-collapsed" : ""}`}>
      <div class="file-tree-header">
        {!collapsed && <span class="file-tree-title">Files</span>}
        <button
          class="file-tree-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand file tree" : "Collapse file tree"}
        >
          {collapsed ? "\u25B6" : "\u25C0"}
        </button>
      </div>
      {!collapsed && (
        <div class="file-tree-list">
          {sortedRoots.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              activeFile={activeFile}
              commentsByFile={commentsByFile}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
