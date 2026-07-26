import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createInternalServerErrorResponse,
  createTestServer,
} from "test-utils";
import { afterEach, describe, expect, test } from "vitest";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packageDir, "../../..");
const generatedCli = path.join(
  repositoryRoot,
  "packages/test-utils/src/test-project/output/command/cli.mts"
);
const generatedCommandBarrel = path.join(
  repositoryRoot,
  "packages/test-utils/src/test-project/output/command/index.ts"
);
const tsxImport = pathToFileURL(
  createRequire(import.meta.url).resolve("tsx")
).href;
const todoId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const accountBody = JSON.stringify({
  email: "cli@example.test",
  password: "correct horse battery staple",
});
const cleanupTasks: Array<() => Promise<void>> = [];

type ProcessResult = {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
};

const closeServer = (
  server: Awaited<ReturnType<typeof createTestServer>>["server"]
): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close(error => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });

const trackServer = async (
  options?: Parameters<typeof createTestServer>[0]
): Promise<Awaited<ReturnType<typeof createTestServer>>> => {
  const server = await createTestServer(options);
  cleanupTasks.push(() => closeServer(server.server));
  return server;
};

const temporaryFile = (content: string): string => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-command-body-")
  );
  const filePath = path.join(directory, "body.json");
  fs.writeFileSync(filePath, content);
  cleanupTasks.push(async () => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return filePath;
};

const startGeneratedCli = (args: readonly string[], input = "") => {
  const child = spawn(
    process.execPath,
    ["--import", tsxImport, generatedCli, ...args],
    {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "pipe",
    }
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => {
    stdout += chunk;
  });
  child.stderr.on("data", chunk => {
    stderr += chunk;
  });
  child.stdin.end(input);
  const result = new Promise<ProcessResult>(resolve => {
    child.once("close", (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
  return { child, result };
};

const runGeneratedCli = async (
  args: readonly string[],
  input = ""
): Promise<ProcessResult> => startGeneratedCli(args, input).result;

const parseOutput = (result: ProcessResult): unknown =>
  JSON.parse(result.stdout);

afterEach(async () => {
  for (const cleanup of cleanupTasks.splice(0).reverse()) await cleanup();
});

describe("generated command isolation", () => {
  test("keeps the executable CLI out of import-safe generated barrels", () => {
    expect(fs.readFileSync(generatedCommandBarrel, "utf8")).not.toContain(
      "./cli"
    );
  });
});

describe("generated command request process", () => {
  test.each([
    {
      mode: "inline",
      buildArgs: () => ["--body", accountBody],
      input: "",
    },
    {
      mode: "file",
      buildArgs: () => ["--body-file", temporaryFile(accountBody)],
      input: "",
    },
    {
      mode: "stdin",
      buildArgs: () => ["--body-stdin"],
      input: accountBody,
    },
  ])("sends a public JSON request from $mode", async ({ buildArgs, input }) => {
    const server = await trackServer();

    const result = await runGeneratedCli(
      ["register-account", "--base-url", server.baseUrl, ...buildArgs()],
      input
    );

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(parseOutput(result)).toMatchObject({
      ok: true,
      operationId: "RegisterAccount",
      response: {
        type: "RegisterAccountSuccess",
        statusCode: 201,
        body: { email: "cli@example.test" },
      },
    });
  });

  test("sends path and contract-derived AND authentication inputs without echoing secrets", async () => {
    let observedAuthorization: string | null = null;
    let observedApiKey: string | null = null;
    const server = await trackServer({
      onRequest: request => {
        observedAuthorization = request.headers.get("Authorization");
        observedApiKey = request.headers.get("X-API-Key");
      },
    });

    const result = await runGeneratedCli([
      "get-todo",
      "--base-url",
      server.baseUrl,
      "--path-todo-id",
      todoId,
      "--auth-bearer-auth",
      "bearer-secret",
      "--auth-api-key-auth",
      "api-key-secret",
    ]);

    expect(result.code).toBe(0);
    expect(parseOutput(result)).toMatchObject({
      ok: true,
      operationId: "GetTodo",
      response: { statusCode: 200, body: { id: todoId } },
    });
    expect(observedAuthorization).toBe("Bearer bearer-secret");
    expect(observedApiKey).toBe("api-key-secret");
    expect(result.stdout).not.toContain("bearer-secret");
    expect(result.stdout).not.toContain("api-key-secret");
  });

  test("forwards deterministic scalar and repeated query flags", async () => {
    let observedUrl = "";
    const server = await trackServer({
      onRequest: request => {
        observedUrl = request.url;
      },
    });

    const result = await runGeneratedCli([
      "list-todos",
      "--base-url",
      server.baseUrl,
      "--auth-bearer-auth",
      "bearer-secret",
      "--query-limit",
      "25",
      "--query-tags",
      "alpha",
      "--query-tags",
      "beta",
    ]);

    expect(result.code).toBe(0);
    const url = new URL(observedUrl);
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.getAll("tags")).toEqual(["alpha", "beta"]);
  });
});

describe("generated command failure process", () => {
  test("reports generated request validation failures with exit code 3", async () => {
    const server = await trackServer();

    const result = await runGeneratedCli([
      "register-account",
      "--base-url",
      server.baseUrl,
      "--body",
      JSON.stringify({ email: "not-an-email", password: "valid-password" }),
    ]);

    expect(result.code).toBe(3);
    expect(parseOutput(result)).toMatchObject({
      ok: false,
      error: { kind: "validation", exitCode: 3 },
    });
  });

  test("returns structured non-2xx responses with exit code 4", async () => {
    const server = await trackServer({
      customResponses: createInternalServerErrorResponse(),
    });

    const result = await runGeneratedCli([
      "register-account",
      "--base-url",
      server.baseUrl,
      "--body",
      accountBody,
    ]);

    expect(result.code).toBe(4);
    expect(parseOutput(result)).toMatchObject({
      ok: true,
      response: { type: "InternalServerError", statusCode: 500 },
    });
  });

  test("reports network failures with exit code 5", async () => {
    const result = await runGeneratedCli([
      "register-account",
      "--base-url",
      "http://127.0.0.1:1",
      "--body",
      accountBody,
    ]);

    expect(result.code).toBe(5);
    expect(parseOutput(result)).toMatchObject({
      ok: false,
      error: { kind: "network", exitCode: 5 },
    });
  });

  test("forwards SIGINT to the generated client signal and exits 130", async () => {
    let markRequestStarted: (() => void) | undefined;
    const requestStarted = new Promise<void>(resolve => {
      markRequestStarted = resolve;
    });
    const server = await trackServer({
      getTodoDelayMs: 2_000,
      onRequest: () => markRequestStarted?.(),
    });
    const running = startGeneratedCli([
      "get-todo",
      "--base-url",
      server.baseUrl,
      "--path-todo-id",
      todoId,
      "--auth-bearer-auth",
      "bearer-secret",
      "--auth-api-key-auth",
      "api-key-secret",
    ]);

    await requestStarted;
    running.child.kill("SIGINT");
    const result = await running.result;

    expect(result).toMatchObject({ code: 130, signal: null });
    expect(parseOutput(result)).toMatchObject({
      ok: false,
      error: { kind: "cancelled", exitCode: 130 },
    });
  }, 15_000);
});
