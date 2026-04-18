import fs from "node:fs";
import path from "node:path";
import { renderTemplate } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";

export function generateIndexFiles(
  templateDir: string,
  context: GeneratorContext
): void {
  const templateFilePath = path.join(templateDir, "Index.ejs");
  const template = fs.readFileSync(templateFilePath, "utf8");

  const nodes = new Map<string, DirectoryNode>();
  const explicitBarrels = new Set<string>();

  const ensureNode = (directory: string): DirectoryNode => {
    const existingNode = nodes.get(directory);
    if (existingNode !== undefined) {
      return existingNode;
    }

    const node: DirectoryNode = {
      fileEntries: new Set(),
      childDirectories: new Set(),
    };
    nodes.set(directory, node);
    return node;
  };

  ensureNode(".");

  for (const generatedFile of context.getGeneratedFiles()) {
    const normalizedFile = generatedFile.replace(/\\/g, "/");
    if (!normalizedFile.endsWith(".ts")) {
      continue;
    }

    const strippedFile = normalizedFile.replace(/\.ts$/, "");
    const directory = path.posix.dirname(strippedFile);
    const fileName = path.posix.basename(strippedFile);

    ensureAncestors(directory, ensureNode);

    if (fileName === "index") {
      explicitBarrels.add(directory);
      continue;
    }

    ensureNode(directory).fileEntries.add(`./${fileName}.js`);
  }

  for (const [directory, node] of nodes) {
    if (directory !== "." && explicitBarrels.has(directory)) {
      continue;
    }

    const indexPaths = new Set<string>(node.fileEntries);
    for (const childDirectory of node.childDirectories) {
      indexPaths.add(`./${childDirectory}/index.js`);
    }

    const content = renderTemplate(template, {
      indexPaths: Array.from(indexPaths).sort(),
    });
    const relativePath =
      directory === "." ? "index.ts" : path.posix.join(directory, "index.ts");

    context.writeFile(relativePath, content);
  }
}

type DirectoryNode = {
  readonly fileEntries: Set<string>;
  readonly childDirectories: Set<string>;
};

const ensureAncestors = (
  directory: string,
  ensureNode: (directory: string) => DirectoryNode
): void => {
  let currentDirectory = directory;

  while (currentDirectory !== ".") {
    const parentDirectory = path.posix.dirname(currentDirectory);
    ensureNode(parentDirectory).childDirectories.add(
      path.posix.basename(currentDirectory)
    );
    ensureNode(currentDirectory);
    currentDirectory = parentDirectory;
  }
};
