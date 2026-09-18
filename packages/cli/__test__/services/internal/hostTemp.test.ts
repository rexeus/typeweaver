import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ReservedCoordinationPathError } from "../../../src/errors/ReservedCoordinationPathError.js";
import { UnsafeSharedTempDirectoryError } from "../../../src/errors/UnsafeSharedTempDirectoryError.js";
import {
  assertPathNotReservedForCoordination,
  canonicalHostTempDirectory,
  ensureTrustedHostTempDirectory,
  fixedHostTempPath,
  isReservedCoordinationPath,
  reservedCoordinationName,
} from "../../../src/services/internal/hostTemp.js";

const tempDirs: string[] = [];

const createTempDir = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-host-temp-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("fixed host temp path policy", () => {
  test("POSIX always uses the platform-fixed /tmp", () => {
    expect(fixedHostTempPath("posix")).toBe("/tmp");
  });

  test("Windows uses the constant system temp C:\\Windows\\Temp", () => {
    expect(fixedHostTempPath("win32")).toBe("C:\\Windows\\Temp");
  });
});

describe("reserved coordination names", () => {
  const windowsTemp = "C:\\Windows\\Temp";
  const lockName = `.typeweaver-output-lock-${"a".repeat(64)}`;
  const fenceName = `${lockName}.fence-${"b".repeat(24)}`;

  test("recognizes exact flat lock, fence, legacy, and staging names under Windows temp", () => {
    expect(
      reservedCoordinationName(
        path.win32.join(windowsTemp, lockName),
        windowsTemp,
        path.win32
      )
    ).toBe(lockName);
    expect(
      reservedCoordinationName(
        path.win32.join(windowsTemp, fenceName),
        windowsTemp,
        path.win32
      )
    ).toBe(fenceName);
    expect(
      reservedCoordinationName(
        path.win32.join(windowsTemp, "typeweaver-output-locks"),
        windowsTemp,
        path.win32
      )
    ).toBe("typeweaver-output-locks");
    expect(
      reservedCoordinationName(
        path.win32.join(windowsTemp, "typeweaver-check-Ab12Z9"),
        windowsTemp,
        path.win32
      )
    ).toBe("typeweaver-check-Ab12Z9");
  });

  test("matches reserved lock and fence names case-insensitively", () => {
    const upperLock = `.TYPEWEAVER-OUTPUT-LOCK-${"A".repeat(64)}`;
    const upperFence = `${upperLock}.FENCE-${"B".repeat(24)}`;
    expect(
      isReservedCoordinationPath(
        path.win32.join(windowsTemp, upperLock),
        windowsTemp,
        path.win32
      )
    ).toBe(true);
    expect(
      isReservedCoordinationPath(
        path.win32.join(windowsTemp, upperFence),
        windowsTemp,
        path.win32
      )
    ).toBe(true);
    expect(
      isReservedCoordinationPath(
        path.win32.join(windowsTemp, "TYPEWEAVER-OUTPUT-LOCKS"),
        windowsTemp,
        path.win32
      )
    ).toBe(true);
    expect(
      isReservedCoordinationPath(
        path.win32.join(windowsTemp, "TypeWeaver-Check-Ab12Z9"),
        windowsTemp,
        path.win32
      )
    ).toBe(true);
  });

  test("does not reserve ordinary project outputs under the temp root", () => {
    expect(
      isReservedCoordinationPath(
        path.win32.join(windowsTemp, "project", "generated"),
        windowsTemp,
        path.win32
      )
    ).toBe(false);
    expect(
      isReservedCoordinationPath(
        path.win32.join(windowsTemp, "typeweaver-check-project"),
        windowsTemp,
        path.win32
      )
    ).toBe(false);
    expect(
      isReservedCoordinationPath("D:\\elsewhere", windowsTemp, path.win32)
    ).toBe(false);
  });

  test("treats the temp root itself as reserved", () => {
    expect(
      isReservedCoordinationPath(windowsTemp, windowsTemp, path.win32)
    ).toBe(true);
  });
});

describe("trusted host temp directory", () => {
  test("accepts the live platform temp root on POSIX", () => {
    if (process.platform === "win32") {
      return;
    }
    expect(() =>
      ensureTrustedHostTempDirectory(canonicalHostTempDirectory())
    ).not.toThrow();
  });

  test("rejects a missing directory", () => {
    const missing = path.join(createTempDir("missing"), "does-not-exist");
    expect(() => ensureTrustedHostTempDirectory(missing)).toThrow(
      UnsafeSharedTempDirectoryError
    );
  });

  test("rejects a non-directory", () => {
    const workspace = createTempDir("file");
    const filePath = path.join(workspace, "not-a-directory");
    fs.writeFileSync(filePath, "x");
    expect(() => ensureTrustedHostTempDirectory(filePath)).toThrow(
      UnsafeSharedTempDirectoryError
    );
  });

  test("rejects a user-owned directory that is not the trusted root", () => {
    if (process.platform === "win32") {
      return;
    }
    const userOwned = createTempDir("user-owned");
    expect(() => ensureTrustedHostTempDirectory(userOwned)).toThrow(
      UnsafeSharedTempDirectoryError
    );
  });
});

describe("reserved path rejection", () => {
  test("allows ordinary project paths under the temp root", () => {
    expect(() =>
      assertPathNotReservedForCoordination(
        path.join(canonicalHostTempDirectory(), "project", "generated")
      )
    ).not.toThrow();
  });

  test("rejects a reserved lock name", () => {
    expect(() =>
      assertPathNotReservedForCoordination(
        path.join(
          canonicalHostTempDirectory(),
          `.typeweaver-output-lock-${"a".repeat(64)}`
        )
      )
    ).toThrow(ReservedCoordinationPathError);
  });

  test("rejects the legacy shared-root name", () => {
    expect(() =>
      assertPathNotReservedForCoordination(
        path.join(canonicalHostTempDirectory(), "typeweaver-output-locks")
      )
    ).toThrow(ReservedCoordinationPathError);
  });

  test("rejects the temp root itself", () => {
    expect(() =>
      assertPathNotReservedForCoordination(canonicalHostTempDirectory())
    ).toThrow(ReservedCoordinationPathError);
  });
});
