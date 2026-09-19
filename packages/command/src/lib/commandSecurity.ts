import { Buffer } from "node:buffer";
import { onlyValue } from "./commandArguments.js";
import { CommandUsageError } from "./commandExitCodes.js";
import type { ParsedArguments } from "./commandArguments.js";
import type {
  GeneratedCommand,
  GeneratedCommandSecurityScheme,
} from "./types.js";

export type SecurityValues = {
  readonly headers: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
};

export const resolveSecurity = (
  command: GeneratedCommand,
  parsed: ParsedArguments
): SecurityValues => {
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  for (const scheme of selectedSecuritySchemes(command, parsed)) {
    const credential = onlyValue(parsed, scheme.flag);
    if (credential === undefined) {
      throw new CommandUsageError(`Missing option '--${scheme.flag}'.`);
    }
    applySecurityScheme(scheme, credential, headers, query);
  }
  return { headers, query };
};

const selectedSecuritySchemes = (
  command: GeneratedCommand,
  parsed: ParsedArguments
): readonly GeneratedCommandSecurityScheme[] => {
  if (command.security.requirements.length === 0) return [];
  const requirement = command.security.requirements.find(names =>
    names.every(name => {
      const scheme = command.security.schemes.find(item => item.name === name);
      return scheme !== undefined && parsed.values.has(scheme.flag);
    })
  );
  if (requirement === undefined) {
    const alternatives = command.security.requirements
      .map(names =>
        names
          .map(name =>
            command.security.schemes.find(item => item.name === name)
          )
          .filter(scheme => scheme !== undefined)
          .map(scheme => `--${scheme.flag}`)
          .join(" + ")
      )
      .join(" or ");
    throw new CommandUsageError(
      `Missing authentication. Provide ${alternatives}.`
    );
  }
  return requirement.flatMap(name => {
    const scheme = command.security.schemes.find(item => item.name === name);
    return scheme === undefined ? [] : [scheme];
  });
};

const applySecurityScheme = (
  scheme: GeneratedCommandSecurityScheme,
  credential: string,
  headers: Record<string, string>,
  query: Record<string, string>
): void => {
  if (scheme.kind === "http") {
    headers["Authorization"] =
      scheme.scheme === "basic"
        ? `Basic ${Buffer.from(credential, "utf8").toString("base64")}`
        : `Bearer ${credential}`;
    return;
  }
  if (scheme.kind !== "apiKey") {
    headers["Authorization"] = `Bearer ${credential}`;
    return;
  }
  if (scheme.location === "header") {
    headers[scheme.credentialName] = credential;
  } else if (scheme.location === "query") {
    query[scheme.credentialName] = credential;
  } else {
    const entry = `${encodeURIComponent(scheme.credentialName)}=${encodeURIComponent(credential)}`;
    headers["Cookie"] =
      headers["Cookie"] === undefined
        ? entry
        : `${headers["Cookie"]}; ${entry}`;
  }
};
