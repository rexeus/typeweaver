import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const nodeScriptExtensions = new Set([".cjs", ".js", ".mjs"]);
const windowsShellExtensions = new Set([".bat", ".cmd"]);

export const resolvePnpmInvocation = ({
  args,
  npmExecPath = process.env.npm_execpath,
  nodeExecPath = process.execPath,
  platform = process.platform,
}) => {
  if (npmExecPath === undefined || npmExecPath === "") {
    throw new Error("Run this command through pnpm.");
  }

  const extension = path.extname(npmExecPath).toLowerCase();
  if (nodeScriptExtensions.has(extension)) {
    return {
      args: [npmExecPath, ...args],
      command: nodeExecPath,
      shell: false,
    };
  }

  return {
    args,
    command: npmExecPath,
    shell: platform === "win32" && windowsShellExtensions.has(extension),
  };
};

export const spawnPnpmSync = ({ args, ...options }) => {
  const invocation = resolvePnpmInvocation({ args });
  return spawnSync(invocation.command, invocation.args, {
    ...options,
    shell: invocation.shell,
  });
};
