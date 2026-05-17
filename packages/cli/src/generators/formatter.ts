import fs from "node:fs";
import path from "node:path";

type FormatFn = (filename: string, source: string) => Promise<{ code: string }>;

export async function formatCode(
  outputDir: string,
  startDir?: string
): Promise<void> {
  const format = await loadFormatter();
  if (!format) {
    return;
  }

  const targetDir = startDir ?? outputDir;
  await formatDirectory(targetDir, format);
}

async function loadFormatter(): Promise<FormatFn | undefined> {
  try {
    const oxfmt = await import("oxfmt");
    return oxfmt.format;
  } catch {
    console.warn(
      "oxfmt not installed - skipping formatting. Install with: npm install -D oxfmt"
    );
    return undefined;
  }
}

async function formatDirectory(
  targetDir: string,
  format: FormatFn
): Promise<void> {
  const contents = fs
    .readdirSync(targetDir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const content of contents) {
    if (content.isFile()) {
      const filePath = path.join(targetDir, content.name);
      const unformatted = fs.readFileSync(filePath, "utf8");
      const { code } = await format(filePath, unformatted);
      fs.writeFileSync(filePath, code);
    } else if (content.isDirectory()) {
      await formatDirectory(path.join(targetDir, content.name), format);
    }
  }
}
