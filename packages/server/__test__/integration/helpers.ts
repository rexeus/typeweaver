import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import type { ChildProcess } from "node:child_process";

export const TEST_UTILS_ROOT = resolve(
  import.meta.dirname,
  "../../../test-utils"
);
export const RUNTIMES_DIR = resolve(
  TEST_UTILS_ROOT,
  "src/test-server/runtimes"
);

const SPAWN_TIMEOUT_MS = 10_000;

export type RuntimeConfig = {
  readonly name: string;
  readonly command: string;
  readonly args: (script: string, port: number) => readonly string[];
  readonly script: string;
  readonly available: boolean;
};

export type RuntimeServer = {
  readonly baseUrl: string;
  readonly kill: () => Promise<void>;
};

export function isRuntimeAvailable(command: string): boolean {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function spawnRuntimeServer(
  config: RuntimeConfig,
  port: number
): Promise<RuntimeServer> {
  return new Promise((resolve, reject) => {
    const args = config.args(config.script, port);
    const child: ChildProcess = spawn(config.command, args as string[], {
      cwd: TEST_UTILS_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });

    let stderr = "";
    let startupSettled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const exitPromise = new Promise<void>(resolveExit => {
      child.once("exit", () => {
        resolveExit();
      });
    });

    const stopServer = async (): Promise<void> => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGTERM");
      }

      const forceKill = setTimeout(() => {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }, 1_000);

      await exitPromise.finally(() => {
        clearTimeout(forceKill);
      });
    };

    const failStartup = (message: string): void => {
      if (startupSettled) return;
      startupSettled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      child.kill("SIGKILL");
      reject(new Error(message));
    };

    const finishStartup = (): void => {
      if (startupSettled) return;
      startupSettled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      resolve({
        baseUrl: `http://localhost:${port}`,
        kill: stopServer,
      });
    };

    timeout = setTimeout(() => {
      failStartup(
        `${config.name} server failed to start within ${SPAWN_TIMEOUT_MS}ms.\nstderr: ${stderr}`
      );
    }, SPAWN_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("READY")) {
        finishStartup();
      }
    });

    child.on("error", err => {
      failStartup(
        `Failed to spawn ${config.name}: ${err.message}\nstderr: ${stderr}`
      );
    });

    child.on("exit", (code, signal) => {
      if (!startupSettled) {
        failStartup(
          `${config.name} server exited before readiness with ${formatExit(
            code,
            signal
          )}.\nstderr: ${stderr}`
        );
      }
    });
  });
}

function formatExit(
  code: number | null,
  signal: NodeJS.Signals | null
): string {
  return code !== null ? `code ${code}` : `signal ${signal ?? "unknown"}`;
}
