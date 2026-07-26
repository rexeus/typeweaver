import { describe, expect, test } from "vitest";
import { runGeneratedCommandCli } from "../src/lib/runtime.js";
import type { GeneratedCommand, GeneratedCommandIo } from "../src/lib/types.js";

const command = (
  execute: GeneratedCommand["execute"] = async () => ({
    type: "PingSuccess",
    statusCode: 200,
    body: { alive: true },
  })
): GeneratedCommand => ({
  name: "ping",
  operationId: "ping",
  summary: "Ping",
  inputs: [],
  headerDefaults: {},
  security: { requirements: [], schemes: [] },
  hasBody: false,
  execute,
});

class GeneratedNetworkError extends Error {
  public override readonly name = "NetworkError";
  public readonly code = "ENOTFOUND";
}

const testIo = (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = {}
): {
  readonly io: GeneratedCommandIo;
  readonly stdout: () => string;
  readonly stderr: () => string;
} => {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      argv,
      env,
      stdinIsTTY: true,
      readFile: async () => "",
      readStdin: async () => "",
      writeStdout: value => {
        stdout += value;
      },
      writeStderr: value => {
        stderr += value;
      },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
};

describe("generated command runtime", () => {
  test("uses the environment base URL and supports stable human output", async () => {
    const fixture = testIo(["ping", "--human"], {
      TYPEWEAVER_BASE_URL: "https://api.example.test",
    });

    const exitCode = await runGeneratedCommandCli(
      { programName: "fixture", commands: [command()] },
      fixture.io
    );

    expect(exitCode).toBe(0);
    expect(fixture.stdout()).toContain("200 PingSuccess (ping)");
    expect(fixture.stderr()).toBe("");
  });

  test("returns a structured usage error when base URL configuration is absent", async () => {
    const fixture = testIo(["ping"]);

    const exitCode = await runGeneratedCommandCli(
      { programName: "fixture", commands: [command()] },
      fixture.io
    );

    expect(exitCode).toBe(2);
    expect(JSON.parse(fixture.stdout())).toMatchObject({
      ok: false,
      error: { kind: "usage", exitCode: 2 },
    });
  });

  test("sanitizes unexpected failures and returns the documented internal exit code", async () => {
    const fixture = testIo(["ping", "--base-url", "https://api.example.test"]);

    const exitCode = await runGeneratedCommandCli(
      {
        programName: "fixture",
        commands: [
          command(async () => {
            throw new Error("sensitive internal detail");
          }),
        ],
      },
      fixture.io
    );

    expect(exitCode).toBe(6);
    expect(JSON.parse(fixture.stdout())).toMatchObject({
      ok: false,
      error: {
        kind: "internal",
        message: "Internal command failure.",
        exitCode: 6,
      },
    });
    expect(fixture.stdout()).not.toContain("sensitive internal detail");
  });

  test("sanitizes credential-bearing network error URLs", async () => {
    const fixture = testIo(["ping", "--base-url", "https://api.example.test"]);

    const exitCode = await runGeneratedCommandCli(
      {
        programName: "fixture",
        commands: [
          command(async () => {
            throw new GeneratedNetworkError(
              "Network error (GET https://api.example.test?apiKey=secret)"
            );
          }),
        ],
      },
      fixture.io
    );

    expect(exitCode).toBe(5);
    expect(JSON.parse(fixture.stdout())).toMatchObject({
      ok: false,
      error: {
        kind: "network",
        message: "Network request failed.",
        exitCode: 5,
        details: { code: "ENOTFOUND" },
      },
    });
    expect(fixture.stdout()).not.toContain("secret");
  });
});
