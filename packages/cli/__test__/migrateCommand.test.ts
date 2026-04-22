import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  detectInstalledTypeweaverVersion,
  handleMigrateCommand,
} from "../src/commands/migrate.js";
import { createTempDirFactory } from "./__helpers__/tempDir.js";
import { createTestLogger } from "./__helpers__/testLogger.js";

describe("handleMigrateCommand", () => {
  const createTempDir = createTempDirFactory("typeweaver-migrate-");

  afterEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

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
    const logger = createTestLogger();

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
    const logger = createTestLogger();

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
    const logger = createTestLogger();

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

  test("parses pre-release specifiers down to their core semver", () => {
    const tempDir = createTempDir();

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@rexeus/typeweaver": "0.8.5-beta.2+build.1",
          },
        },
        null,
        2
      )
    );

    expect(detectInstalledTypeweaverVersion(tempDir)).toBe("0.8.5");
  });

  test("returns undefined for opaque specifiers such as workspace:* or git URLs", () => {
    const tempDir = createTempDir();

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@rexeus/typeweaver": "workspace:*",
          },
        },
        null,
        2
      )
    );

    expect(detectInstalledTypeweaverVersion(tempDir)).toBeUndefined();

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@rexeus/typeweaver": "git+https://github.com/rexeus/typeweaver",
          },
        },
        null,
        2
      )
    );

    expect(detectInstalledTypeweaverVersion(tempDir)).toBeUndefined();
  });

  test("falls through to the next dep group when a specifier is unparseable", () => {
    const tempDir = createTempDir();

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@rexeus/typeweaver": "workspace:*",
          },
          devDependencies: {
            "@rexeus/typeweaver-core": "^0.8.4",
          },
        },
        null,
        2
      )
    );

    expect(detectInstalledTypeweaverVersion(tempDir)).toBe("0.8.4");
  });

  test("rejects 0.6.x projects with a clear unsupported-version error", async () => {
    const tempDir = createTempDir();
    const logger = createTestLogger();

    const summary = await handleMigrateCommand(
      {
        from: "0.6.4",
      },
      {
        execDir: tempDir,
        createLogger: () => logger,
      }
    );

    expect(summary).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("No bundled migration guidance is available")
    );
    expect(process.exitCode).toBe(1);
  });

  test("fails with guidance when no version can be detected", async () => {
    const tempDir = createTempDir();
    const logger = createTestLogger();

    const summary = await handleMigrateCommand(
      {},
      {
        execDir: tempDir,
        createLogger: () => logger,
      }
    );

    expect(summary).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Could not detect an installed Typeweaver version"
      )
    );
    expect(process.exitCode).toBe(1);
  });
});
