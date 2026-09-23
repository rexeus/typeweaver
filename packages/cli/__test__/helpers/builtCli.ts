import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { ChildProcess } from "node:child_process";

export type ProcessResult = {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type RunCliOptions = {
  /** Variables layered over the parent environment before colors are disabled. */
  readonly environment?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
};

/**
 * Kill deadline for one spawned CLI process. An unloaded spawn takes 2-5 s for
 * Node startup, spec bundling, and generation. With the CPU oversubscribed
 * threefold, whole tests of up to three spawns took as long as 28 s.
 */
export const CLI_PROCESS_TIMEOUT_MS = 30_000;

/**
 * Vitest timeout for a test that spawns processes; `vitest.config.ts` applies
 * it to `*.process` suites. It exceeds the kill deadline so a hung CLI fails
 * with the runner's error naming its arguments, not a generic test timeout,
 * and leaves room for the healthy spawns before it. Unit tests keep the
 * default timeout, so a hang there is still reported within seconds.
 */
export const PROCESS_TEST_TIMEOUT_MS = 90_000;

export const packageDirectory = path.resolve(import.meta.dirname, "..", "..");

export const cliEntry = path.join(packageDirectory, "bin", "typeweaver.mjs");

/**
 * Runs the built CLI with colors disabled and resolves with CRLF-normalized
 * output. On timeout the child is killed and the promise rejects only after
 * the process has closed, so no stray CLI outlives the test.
 */
export const runCli = (
  workspace: string,
  args: readonly string[],
  options: RunCliOptions = {}
): Promise<ProcessResult> =>
  new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(process.execPath, [cliEntry, ...args], {
      cwd: workspace,
      env: {
        ...process.env,
        ...options.environment,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", chunk => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", chunk => {
      stderr += String(chunk);
    });
    let timeoutError: Error | undefined;
    const timeout = setTimeout(() => {
      timeoutError = new Error(
        `Built CLI process timed out: ${args.join(" ")}`
      );
      child.kill("SIGKILL");
    }, options.timeoutMs ?? CLI_PROCESS_TIMEOUT_MS);
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (timeoutError !== undefined) {
        reject(timeoutError);
        return;
      }
      resolve({
        code,
        signal,
        stdout: stdout.replace(/\r\n/g, "\n"),
        stderr: stderr.replace(/\r\n/g, "\n"),
      });
    });
  });

export type ProcessWorkspaces = {
  readonly createWorkspace: () => string;
  readonly removeWorkspaces: () => void;
};

/**
 * Creates throwaway project workspaces under `test/outputs/<outputName>`.
 * Register `removeWorkspaces` with `afterEach`.
 */
export const processWorkspaces = (outputName: string): ProcessWorkspaces => {
  const outputsDirectory = path.join(
    packageDirectory,
    "test",
    "outputs",
    outputName
  );
  const workspaces: string[] = [];
  return {
    createWorkspace: () => {
      fs.mkdirSync(outputsDirectory, { recursive: true });
      const workspace = fs.mkdtempSync(
        path.join(outputsDirectory, "workspace-")
      );
      workspaces.push(workspace);
      return workspace;
    },
    removeWorkspaces: () => {
      for (const workspace of workspaces.splice(0)) {
        fs.rmSync(workspace, { recursive: true, force: true });
      }
    },
  };
};
