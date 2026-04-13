import path from "node:path";

export function relative(from: string, to: string): string {
  const relativePath = path.relative(from, to);

  const posixPath = relativePath.split(path.sep).join("/");

  if (!posixPath.startsWith("./") && !posixPath.startsWith("../")) {
    return `./${posixPath}`;
  }

  return posixPath;
}
