import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  detectInstalledTypeweaverVersion,
  handleMigrateCommand,
} from "../src/commands/migrate.js";
import type { Logger } from "../src/logger.js";

const createLogger = (): Logger => {
  return {
    isVerbose: false,
    debug: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    summary: vi.fn(),
  };
};

describe("handleMigrateCommand", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  const createTempDir = (): string => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-migrate-"));
    tempDirs.push(tempDir);

    return tempDir;
  };

  test("detects the installed project version from package.json", () => {
    const tempDir = createTempDir();

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          devDependencies: {
            "@rexeus/typeweaver": "^0.8.4",
          },
        },
        null,
        2
      )
    );

    expect(detectInstalledTypeweaverVersion(tempDir)).toBe("0.8.4");
  });

  test("prints concise migration guidance for detected 0.8 projects", async () => {
    const tempDir = createTempDir();
    const logger = createLogger();

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@rexeus/typeweaver-core": "~0.8.7",
          },
        },
        null,
        2
      )
    );

    const summary = await handleMigrateCommand(
      {},
      {
        execDir: tempDir,
        createLogger: () => logger,
      }
    );

    expect(summary).toEqual(
      expect.objectContaining({
        mode: "migrate",
        detectedVersion: "0.8.7",
        advisoryCount: 7,
      })
    );
    expect(logger.info).toHaveBeenCalledWith("0.8.x → 0.9.x");
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("defineSpec")
    );
  });

  test("supports explicit --from values for 0.7 projects", async () => {
    const tempDir = createTempDir();
    const logger = createLogger();

    const summary = await handleMigrateCommand(
      {
        from: "0.7.12",
      },
      {
        execDir: tempDir,
        createLogger: () => logger,
      }
    );

    expect(summary).toEqual(
      expect.objectContaining({
        detectedVersion: "0.7.12",
        advisoryCount: 12,
      })
    );
    expect(logger.info).toHaveBeenCalledWith("0.7.x → 0.8.x");
    expect(logger.info).toHaveBeenCalledWith("0.8.x → 0.9.x");
  });

  test("reports when no bundled migration guidance is needed", async () => {
    const tempDir = createTempDir();
    const logger = createLogger();

    const summary = await handleMigrateCommand(
      {
        from: "0.9.1",
      },
      {
        execDir: tempDir,
        createLogger: () => logger,
      }
    );

    expect(summary).toEqual(
      expect.objectContaining({
        mode: "migrate",
        detectedVersion: "0.9.1",
        advisoryCount: 0,
      })
    );
    expect(logger.success).toHaveBeenCalledWith(
      expect.stringContaining("No bundled migration guidance is needed")
    );
  });

  test("fails clearly when no version can be detected", async () => {
    const tempDir = createTempDir();
    const logger = createLogger();

    const summary = await handleMigrateCommand(
      {},
      {
        execDir: tempDir,
        createLogger: () => logger,
      }
    );

    expect(summary).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Could not detect an installed Typeweaver version")
    );
    expect(process.exitCode).toBe(1);
  });
});
