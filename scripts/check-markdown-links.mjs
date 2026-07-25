import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const markdownFiles = execFileSync("git", ["ls-files", "-z", "*.md"], {
  cwd: workspaceRoot,
})
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const broken = [];
const linkPattern = /!?\[[^\]]*\]\(([^)\n]+)\)/g;

for (const markdownFile of markdownFiles) {
  const content = readFileSync(path.join(workspaceRoot, markdownFile), "utf8");
  for (const match of content.matchAll(linkPattern)) {
    let target = match[1]?.trim() ?? "";
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    target = target.replace(/\s+(?:"[^"]*"|'[^']*')$/, "");
    if (
      target === "" ||
      target.startsWith("#") ||
      /^[a-z][a-z+.-]*:/i.test(target)
    ) {
      continue;
    }

    const fileTarget = decodeURIComponent(target.split("#", 1)[0] ?? "");
    const resolved = fileTarget.startsWith("/")
      ? path.join(workspaceRoot, fileTarget)
      : path.resolve(
          path.dirname(path.join(workspaceRoot, markdownFile)),
          fileTarget
        );
    if (!existsSync(resolved)) {
      const line = content.slice(0, match.index).split("\n").length;
      broken.push(`${markdownFile}:${line} -> ${target}`);
    }
  }
}

if (broken.length > 0) {
  process.stderr.write(`Broken local Markdown links:\n${broken.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Local Markdown links verified across ${markdownFiles.length} tracked files\n`
);
