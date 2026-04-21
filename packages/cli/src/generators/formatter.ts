import fs from "node:fs";
import path from "node:path";

type FormatFn = (filename: string, source: string) => Promise<{ code: string }>;

const FORMATTABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

export async function formatCode(
  outputDir: string,
  startDir?: string
): Promise<readonly string[]> {
  const format = await loadFormatter();
  if (!format) {
    return [
      "oxfmt not installed - skipping formatting. Install with: npm install -D oxfmt",
    ];
  }

  const targetDir = startDir ?? outputDir;
  await formatDirectory(targetDir, format);

  return [];
}

export async function isFormatterAvailable(): Promise<boolean> {
  const format = await loadFormatter();

  return format !== undefined;
}

async function loadFormatter(): Promise<FormatFn | undefined> {
  try {
    const oxfmt = await import("oxfmt");
    return oxfmt.format;
  } catch {
    return undefined;
  }
}

async function formatDirectory(
  targetDir: string,
  format: FormatFn
): Promise<void> {
  const contents = fs.readdirSync(targetDir, { withFileTypes: true });

  for (const content of contents) {
    if (content.isFile()) {
      if (!FORMATTABLE_EXTENSIONS.has(path.extname(content.name))) {
        continue;
      }
      const filePath = path.join(targetDir, content.name);
      const unformatted = fs.readFileSync(filePath, "utf8");
      const { code } = await format(filePath, unformatted);
      fs.writeFileSync(filePath, code);
    } else if (content.isDirectory()) {
      await formatDirectory(path.join(targetDir, content.name), format);
    }
  }
}
