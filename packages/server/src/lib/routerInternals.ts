import {
  findReservedPathParameter,
  ReservedPathParameterError,
} from "@rexeus/typeweaver-core";
import type { HttpMethod } from "@rexeus/typeweaver-core";
import {
  AmbiguousPathSegmentError,
  ConflictingPathParameterNameError,
} from "./errors/index.js";
import type { RouteDefinition } from "./routerTypes.js";

type StaticSegmentToken = { readonly kind: "static"; readonly value: string };
type ParamSegmentToken = { readonly kind: "param"; readonly name: string };
export type SegmentToken = StaticSegmentToken | ParamSegmentToken;

export type SegmentPattern = {
  readonly tokens: readonly SegmentToken[];
  readonly parameterNames: readonly string[];
  readonly staticLength: number;
  readonly shape: string;
};

export type DynamicSegmentChild = {
  readonly pattern: SegmentPattern;
  readonly node: RadixNode;
};

export type RadixNode = {
  readonly staticChildren: Map<string, RadixNode>;
  readonly dynamicChildren: Map<string, DynamicSegmentChild>;
  readonly methods: Map<string, RouteDefinition>;
};

export function createNode(): RadixNode {
  return {
    staticChildren: new Map(),
    dynamicChildren: new Map(),
    methods: new Map(),
  };
}

export function assertPathHasNoReservedParameter(path: string): void {
  const reservedPathParameter = findReservedPathParameter(path);
  if (reservedPathParameter !== undefined) {
    throw new ReservedPathParameterError(path, reservedPathParameter);
  }
}

export function normalizeDefinition(
  definition: RouteDefinition,
  method: string
): RouteDefinition {
  return definition.method === method
    ? definition
    : { ...definition, method: method as HttpMethod };
}

export function descend(
  node: RadixNode,
  path: string,
  pattern: SegmentPattern
): RadixNode {
  if (pattern.tokens.every(token => token.kind === "static")) {
    const value = pattern.tokens
      .map(token => (token.kind === "static" ? token.value : ""))
      .join("");
    let child = node.staticChildren.get(value);
    if (child === undefined) {
      child = createNode();
      node.staticChildren.set(value, child);
    }
    return child;
  }

  const existing = node.dynamicChildren.get(pattern.shape);
  if (existing !== undefined) {
    if (!sameParameterNames(existing.pattern, pattern)) {
      throw new ConflictingPathParameterNameError(
        path,
        existing.pattern.parameterNames.join(", "),
        pattern.parameterNames.join(", ")
      );
    }
    return existing.node;
  }

  const child = createNode();
  node.dynamicChildren.set(pattern.shape, { pattern, node: child });
  return child;
}

export function parseSegment(segment: string, path: string): SegmentPattern {
  const tokens: SegmentToken[] = [];
  let staticBuffer = "";
  let index = 0;
  const flushStatic = (): void => {
    if (staticBuffer.length > 0) {
      tokens.push({ kind: "static", value: staticBuffer });
      staticBuffer = "";
    }
  };

  while (index < segment.length) {
    const placeholder = readPlaceholder(segment, index);
    if (placeholder !== undefined) {
      flushStatic();
      if (tokens.at(-1)?.kind === "param") {
        throw new AmbiguousPathSegmentError(path, segment);
      }
      tokens.push({ kind: "param", name: placeholder.name });
      index += placeholder.length;
      continue;
    }
    staticBuffer += segment.charAt(index);
    index += 1;
  }

  flushStatic();
  const parameterNames = tokens
    .filter((token): token is ParamSegmentToken => token.kind === "param")
    .map(token => token.name);
  const staticLength = tokens.reduce(
    (total, token) =>
      total + (token.kind === "static" ? token.value.length : 0),
    0
  );
  const shape = JSON.stringify(
    tokens.map(token => (token.kind === "static" ? ["s", token.value] : ["p"]))
  );
  return { tokens, parameterNames, staticLength, shape };
}

function readPlaceholder(
  segment: string,
  start: number
): { readonly name: string; readonly length: number } | undefined {
  if (segment.charAt(start) !== ":") return undefined;
  const name = readPlaceholderName(segment, start + 1);
  return name === undefined ? undefined : { name, length: 1 + name.length };
}

function readPlaceholderName(
  segment: string,
  start: number
): string | undefined {
  let end = start;
  while (end < segment.length) {
    const code = segment.charCodeAt(end);
    const isNameCharacter =
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      code === 0x5f;
    if (!isNameCharacter) break;
    end += 1;
  }
  return end > start ? segment.slice(start, end) : undefined;
}

function sameParameterNames(
  left: SegmentPattern,
  right: SegmentPattern
): boolean {
  return (
    left.parameterNames.length === right.parameterNames.length &&
    left.parameterNames.every(
      (name, index) => name === right.parameterNames[index]
    )
  );
}

export function toSegments(path: string): string[] {
  return path.split("/").filter(segment => segment.length > 0);
}
