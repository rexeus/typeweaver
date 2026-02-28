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
  readonly kill: () => void;
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
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(
          `${config.name} server failed to start within ${SPAWN_TIMEOUT_MS}ms.\nstderr: ${stderr}`
        )
      );
    }, SPAWN_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("READY")) {
        clearTimeout(timeout);
        resolve({
          baseUrl: `http://localhost:${port}`,
          kill: () => child.kill("SIGKILL"),
        });
      }
    });

    child.on("error", err => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Failed to spawn ${config.name}: ${err.message}\nstderr: ${stderr}`
        )
      );
    });

    child.on("exit", code => {
      clearTimeout(timeout);
      if (code !== null && code !== 0) {
        reject(
          new Error(
            `${config.name} server exited with code ${code}.\nstderr: ${stderr}`
          )
        );
      }
    });
  });
}

export async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(url, init);
  const body = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : null;
  return { status: res.status, body, headers: res.headers };
}
