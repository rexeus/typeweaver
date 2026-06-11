import fs from "node:fs";
import path from "node:path";
import { Effect } from "effect";

type FormatFn = (filename: string, source: string) => Promise<{ code: string }>;

const loadFormatter = (): Effect.Effect<FormatFn | undefined> =>
  Effect.gen(function* () {
    const loaded = yield* Effect.tryPromise({
      try: () => import("oxfmt"),
      catch: error => error,
    }).pipe(Effect.either);

    if (loaded._tag === "Left") {
      yield* Effect.logWarning(
        "oxfmt not installed - skipping formatting. Install with: npm install -D oxfmt"
      );
      return undefined;
    }

    return loaded.right.format;
  });

const formatDirectory = async (
  targetDir: string,
  format: FormatFn
): Promise<void> => {
  const contents = fs
    .readdirSync(targetDir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const content of contents) {
    // Skip atomic-write tempdirs and the lockfile sentinel — both are
    // hidden coordination artifacts, not user-facing output. Walking
    // into them would re-read/rewrite in-flight content from another
    // run (`.typeweaver-XXXX/generated.tmp`) or the live lockfile
    // metadata (`.typeweaver-lock/info.json`).
    if (content.name.startsWith(".typeweaver-")) {
      continue;
    }

    if (content.isFile()) {
      const filePath = path.join(targetDir, content.name);
      const unformatted = fs.readFileSync(filePath, "utf8");
      const { code } = await format(filePath, unformatted);
      fs.writeFileSync(filePath, code);
    } else if (content.isDirectory()) {
      await formatDirectory(path.join(targetDir, content.name), format);
    }
  }
};

const formatOutputDir = (
  outputDir: string,
  startDir?: string
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const format = yield* loadFormatter();
    if (format === undefined) {
      return;
    }
    const targetDir = startDir ?? outputDir;
    // The walk can reject (fs errors, oxfmt throwing on malformed input).
    // Both indicate generator bugs or a corrupted output tree — there is
    // no recovery path here, so the failure is explicitly promoted to a
    // defect rather than silently relying on `Effect.promise` semantics.
    yield* Effect.tryPromise(() => formatDirectory(targetDir, format)).pipe(
      Effect.orDie
    );
  });

/**
 * Effect-native `oxfmt` facade. The missing-tool warning routes through
 * `Effect.logWarning` so it lands in the same logger pipeline as the rest
 * of the run (ADR 0006), and the recursive filesystem walk is wrapped in
 * `Effect.promise` so callers compose it like any other effect.
 *
 * Filesystem failures (read/write/readdir) propagate as defects — the
 * formatter is best-effort and has no recovery path.
 */
export class Formatter extends Effect.Service<Formatter>()(
  "typeweaver/Formatter",
  {
    succeed: {
      format: (outputDir: string, startDir?: string): Effect.Effect<void> =>
        formatOutputDir(outputDir, startDir),
    },
    accessors: true,
  }
) {}
