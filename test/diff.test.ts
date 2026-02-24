import { describe, expect, test } from "bun:test";
import { parseDiffFiles } from "../src/server/diff.ts";

const MODIFIED_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index abc1234..def5678 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 export { a, b };`;

const NEW_FILE_DIFF = `diff --git a/src/bar.ts b/src/bar.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/bar.ts
@@ -0,0 +1,2 @@
+export const bar = "hello";
+export default bar;`;

const DELETED_FILE_DIFF = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const old = true;
-export default old;`;

const RENAMED_DIFF = `diff --git a/src/before.ts b/src/after.ts
similarity index 90%
rename from src/before.ts
rename to src/after.ts
index abc1234..def5678 100644
--- a/src/before.ts
+++ b/src/after.ts
@@ -1,2 +1,2 @@
-export const name = "before";
+export const name = "after";`;

describe("parseDiffFiles", () => {
  test("parses modified file", () => {
    const files = parseDiffFiles(MODIFIED_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0]!.filename).toBe("src/foo.ts");
    expect(files[0]!.status).toBe("modified");
    expect(files[0]!.rawDiff).toContain("const b = 3");
  });

  test("parses new file", () => {
    const files = parseDiffFiles(NEW_FILE_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0]!.filename).toBe("src/bar.ts");
    expect(files[0]!.status).toBe("added");
  });

  test("parses deleted file", () => {
    const files = parseDiffFiles(DELETED_FILE_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0]!.filename).toBe("src/old.ts");
    expect(files[0]!.status).toBe("deleted");
  });

  test("parses renamed file", () => {
    const files = parseDiffFiles(RENAMED_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0]!.filename).toBe("src/after.ts");
    expect(files[0]!.status).toBe("renamed");
    expect(files[0]!.oldFilename).toBe("src/before.ts");
  });

  test("handles empty diff", () => {
    expect(parseDiffFiles("")).toHaveLength(0);
    expect(parseDiffFiles("  \n  ")).toHaveLength(0);
  });

  test("parses multiple files in one diff", () => {
    const combined = [MODIFIED_DIFF, NEW_FILE_DIFF, DELETED_FILE_DIFF].join(
      "\n"
    );
    const files = parseDiffFiles(combined);
    expect(files).toHaveLength(3);
    expect(files.map((f) => f.status)).toEqual([
      "modified",
      "added",
      "deleted",
    ]);
  });
});
