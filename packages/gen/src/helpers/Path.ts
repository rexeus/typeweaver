import path from "node:path";

export class Path {
  public static relative(from: string, to: string): string {
    const relativePath = path.relative(from, to);

    // TODO: this should not be required anymore, since we are using pnpm
    if (relativePath.includes("node_modules")) {
      const parts = relativePath.split(path.sep);
      const index = parts.indexOf("node_modules");
      return parts.slice(index + 1).join(path.sep);
    }

    if (!relativePath.startsWith("./") && !relativePath.startsWith("../")) {
      return `./${relativePath}`;
    }

    return relativePath;
  }
}
