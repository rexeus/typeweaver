import path from "node:path";

export class Path {
  public static relative(from: string, to: string): string {
    const relativePath = path.relative(from, to);

    if (relativePath.includes("node_modules")) {
      const parts = relativePath.split(path.sep);
      const index = parts.indexOf("node_modules");
      return parts.slice(index + 1).join("/");
    }

    const posixPath = relativePath.split(path.sep).join("/");

    if (!posixPath.startsWith("./") && !posixPath.startsWith("../")) {
      return `./${posixPath}`;
    }

    return posixPath;
  }
}
