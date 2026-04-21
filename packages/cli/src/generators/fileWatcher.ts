import fs from "node:fs";
import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { writeDiagnostic } from "../diagnosticFormatter.js";
import { createLogger } from "../logger.js";
import { Generator } from "./generator.js";
import type { Logger } from "../logger.js";
import type { GeneratorConfig } from "./generator.js";

const WATCHED_EXTENSIONS = new Set([".ts", ".js", ".json", ".mjs", ".cjs"]);
const DEBOUNCE_MS = 200;

export type GeneratorFactory = () => Generator;

export class FileWatcher {
  private readonly watchers: fs.FSWatcher[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isGenerating = false;
  private pendingRegeneration = false;
  private stopped = false;
  private resolveWatch: (() => void) | null = null;
  private shutdownHandler: (() => void) | null = null;
  private readonly watchDir: string;

  public constructor(
    private readonly inputPath: string,
    private readonly outputDir: string,
    private readonly config: TypeweaverConfig,
    private readonly createGenerator: GeneratorFactory = () => new Generator(),
    private readonly logger: Logger = createLogger()
  ) {
    this.watchDir = path.dirname(this.inputPath);
  }

  public async watch(): Promise<void> {
    await this.runGeneration(true);

    this.startWatching();
    this.setupShutdownHandlers();

    this.logger.success(`Watching for changes in ${this.watchDir}...`);

    return new Promise<void>(resolve => {
      this.resolveWatch = resolve;
    });
  }

  public stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.stopped = true;

    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers.length = 0;

    if (this.shutdownHandler) {
      process.removeListener("SIGINT", this.shutdownHandler);
      process.removeListener("SIGTERM", this.shutdownHandler);
      this.shutdownHandler = null;
    }

    this.resolveWatch?.();
    this.resolveWatch = null;
  }

  private startWatching(): void {
    for (const dir of this.getWatchDirs()) {
      const watcher = fs.watch(dir, { recursive: true });

      watcher.on("change", (_eventType, filename) => {
        if (this.shouldIgnore(filename as string | null)) return;
        this.logger.info(`Change detected: ${String(filename)}`);
        this.scheduleRegeneration();
      });

      watcher.on("error", error => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          this.logger.warn(`Watch error: ${error.message}`);
        }
      });

      this.watchers.push(watcher);
    }
  }

  private getWatchDirs(): readonly string[] {
    return [this.watchDir];
  }

  private shouldIgnore(filename: string | null): boolean {
    if (!filename) return false;
    const ext = path.extname(filename);
    return ext !== "" && !WATCHED_EXTENSIONS.has(ext);
  }

  private scheduleRegeneration(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.triggerRegeneration();
    }, DEBOUNCE_MS);
  }

  private async triggerRegeneration(): Promise<void> {
    if (this.isGenerating) {
      this.pendingRegeneration = true;
      return;
    }
    if (this.stopped) {
      return;
    }

    this.isGenerating = true;
    try {
      do {
        this.pendingRegeneration = false;
        await this.runGeneration(false);
      } while (this.pendingRegeneration && !this.stopped);
    } finally {
      this.isGenerating = false;
    }
  }

  private async runGeneration(isInitial: boolean): Promise<void> {
    const start = performance.now();
    const config: GeneratorConfig = isInitial
      ? this.config
      : { ...this.config, clean: false };

    try {
      if (!isInitial) this.logger.step("Regenerating...");
      const generator = this.createGenerator();
      const summary = await generator.generate(
        this.inputPath,
        this.outputDir,
        config
      );
      const elapsed = Math.round(performance.now() - start);
      if (!isInitial) {
        this.logger.success(`Regeneration complete (${elapsed}ms)`);
        this.logger.summary(summary);
      }
    } catch (error) {
      writeDiagnostic(this.logger, error);
    }
  }

  private setupShutdownHandlers(): void {
    this.shutdownHandler = () => {
      this.logger.step("Stopping watcher...");
      this.stop();
    };

    process.once("SIGINT", this.shutdownHandler);
    process.once("SIGTERM", this.shutdownHandler);
  }
}
