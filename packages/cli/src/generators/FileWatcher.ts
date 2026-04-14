import fs from "node:fs";
import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Generator } from "./generator.js";

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
    private readonly createGenerator: GeneratorFactory = () => new Generator()
  ) {
    this.watchDir = path.dirname(this.inputPath);
  }

  public async watch(): Promise<void> {
    await this.runGeneration(true);

    this.startWatching();
    this.setupShutdownHandlers();

    this.log(`Watching for changes in ${this.watchDir}...`);

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
        this.log(`Change detected: ${String(filename)}`);
        this.scheduleRegeneration();
      });

      watcher.on("error", error => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          this.log(`Watch error: ${error.message}`);
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
    if (this.stopped || this.isGenerating) {
      if (this.isGenerating) this.pendingRegeneration = true;
      return;
    }

    this.isGenerating = true;
    await this.runGeneration(false);
    this.isGenerating = false;

    if (this.pendingRegeneration && !this.stopped) {
      this.pendingRegeneration = false;
      await this.triggerRegeneration();
    }
  }

  private async runGeneration(isInitial: boolean): Promise<void> {
    const start = performance.now();
    const config: TypeweaverConfig = isInitial
      ? this.config
      : { ...this.config, clean: false };

    try {
      if (!isInitial) this.log("Regenerating...");
      const generator = this.createGenerator();
      await generator.generate(this.inputPath, this.outputDir, config);
      const elapsed = Math.round(performance.now() - start);
      if (!isInitial) this.log(`Regeneration complete (${elapsed}ms)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Generation failed: ${message}`);
    }
  }

  private setupShutdownHandlers(): void {
    this.shutdownHandler = () => {
      this.log("Stopping watcher...");
      this.stop();
    };

    process.once("SIGINT", this.shutdownHandler);
    process.once("SIGTERM", this.shutdownHandler);
  }

  private log(message: string): void {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    console.info(`[${time}] ${message}`);
  }
}
