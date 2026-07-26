import assert from "node:assert/strict";
import process from "node:process";
import { resolvePnpmInvocation, spawnPnpmSync } from "./lib/pnpm-command.mjs";

// pnpm/action-setup may expose npm_execpath as JavaScript, a native binary,
// or a Windows command shim. Keep every supported launcher shape explicit.

assert.throws(
  () =>
    resolvePnpmInvocation({
      args: ["--version"],
      npmExecPath: "",
    }),
  /Run this command through pnpm/
);

assert.deepEqual(
  resolvePnpmInvocation({
    args: ["run", "lint"],
    nodeExecPath: "/runtime/node",
    npmExecPath: "/tools/pnpm.cjs",
    platform: "linux",
  }),
  {
    args: ["/tools/pnpm.cjs", "run", "lint"],
    command: "/runtime/node",
    shell: false,
  }
);

assert.deepEqual(
  resolvePnpmInvocation({
    args: ["run", "lint"],
    nodeExecPath: "/runtime/node",
    npmExecPath: "/tools/pnpm",
    platform: "linux",
  }),
  {
    args: ["run", "lint"],
    command: "/tools/pnpm",
    shell: false,
  }
);

assert.deepEqual(
  resolvePnpmInvocation({
    args: ["run", "lint"],
    nodeExecPath: "C:\\runtime\\node.exe",
    npmExecPath: "C:\\tools\\pnpm.cmd",
    platform: "win32",
  }),
  {
    args: ["run", "lint"],
    command: "C:\\tools\\pnpm.cmd",
    shell: true,
  }
);

const environmentSelectedLauncher = spawnPnpmSync({
  args: ["--version"],
  encoding: "utf8",
  env: {
    ...process.env,
    npm_execpath: process.execPath,
  },
});
assert.equal(
  environmentSelectedLauncher.status,
  0,
  environmentSelectedLauncher.stderr
);
assert.equal(environmentSelectedLauncher.stdout.trim(), process.version);

const activePnpm = spawnPnpmSync({
  args: ["--version"],
  encoding: "utf8",
  env: process.env,
});
assert.equal(activePnpm.status, 0, activePnpm.stderr);
assert.match(activePnpm.stdout.trim(), /^\d+\.\d+\.\d+$/u);

process.stdout.write(
  "pnpm launcher verified for JavaScript, native, and Windows command entrypoints\n"
);
