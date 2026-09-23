import type {
  DynamicSegmentChild,
  RadixNode,
  SegmentPattern,
  SegmentToken,
} from "./routerInternals.js";

/**
 * Recursively traverse the radix tree to find a matching node.
 *
 * Static children are tried first (exact match). Dynamic children are then
 * tried most-specific-first (longer literal text wins), so an embedded
 * pattern such as `:fileId.:format` is preferred over a bare `:fileId`
 * fallback. Captured params are removed again when a branch backtracks.
 *
 * Path parameters are URL-decoded during extraction.
 */
export function traverse(
  node: RadixNode,
  segments: string[],
  index: number,
  params: Record<string, string>
): RadixNode | undefined {
  if (index === segments.length) return node;
  const segment = segments[index] ?? "";
  const staticChild = node.staticChildren.get(segment);
  if (staticChild) {
    const result = traverse(staticChild, segments, index + 1, params);
    if (result && result.methods.size > 0) return result;
  }

  for (const candidate of sortedDynamicChildren(node)) {
    const captured = matchSegment(candidate.pattern, segment);
    if (captured === undefined) continue;
    const capturedNames = writeCaptured(captured, params);
    const result = traverse(candidate.node, segments, index + 1, params);
    if (result && result.methods.size > 0) return result;
    clearCaptured(capturedNames, params);
  }
  return undefined;
}

function writeCaptured(
  captured: Record<string, string>,
  params: Record<string, string>
): string[] {
  const names = Object.keys(captured);
  for (const name of names) params[name] = captured[name] ?? "";
  return names;
}

function clearCaptured(
  names: readonly string[],
  params: Record<string, string>
): void {
  for (const name of names) delete params[name];
}

function sortedDynamicChildren(node: RadixNode): DynamicSegmentChild[] {
  return [...node.dynamicChildren.values()].sort(
    (left, right) =>
      right.pattern.staticLength - left.pattern.staticLength ||
      left.pattern.shape.localeCompare(right.pattern.shape)
  );
}

/**
 * Matches one request segment against a parsed segment pattern, returning the
 * captured (and URL-decoded) placeholder values, or `undefined` when the
 * segment does not fit.
 */
function matchSegment(
  pattern: SegmentPattern,
  segment: string
): Record<string, string> | undefined {
  const captured: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  let cursor = 0;
  for (let index = 0; index < pattern.tokens.length; index += 1) {
    const token = pattern.tokens[index];
    if (token === undefined) return undefined;
    if (token.kind === "static") {
      if (!segment.startsWith(token.value, cursor)) return undefined;
      cursor += token.value.length;
      continue;
    }
    const matched = matchParamToken(pattern.tokens[index + 1], segment, cursor);
    if (matched === undefined) return undefined;
    captured[token.name] = matched.value;
    cursor = matched.nextCursor;
  }
  return cursor === segment.length ? captured : undefined;
}

function matchParamToken(
  next: SegmentToken | undefined,
  segment: string,
  cursor: number
): { readonly value: string; readonly nextCursor: number } | undefined {
  if (next === undefined) {
    if (cursor >= segment.length) return undefined;
    return {
      value: decodePathSegment(segment.slice(cursor)),
      nextCursor: segment.length,
    };
  }
  if (next.kind !== "static") return undefined;
  const end = segment.indexOf(next.value, cursor);
  if (end === -1 || end === cursor) return undefined;
  return {
    value: decodePathSegment(segment.slice(cursor, end)),
    nextCursor: end,
  };
}

/**
 * Decodes a URL-encoded path segment while guarding against path traversal.
 *
 * Encoded dot-segments like `%2e%2e` would decode to `..`, which could
 * enable directory traversal if a downstream handler builds file paths
 * from params. Returning the raw segment neutralises this vector; the same
 * applies to `.` and to encoded `/` or `\` separators, and a malformed escape
 * sequence also leaves the segment raw.
 */
function decodePathSegment(segment: string): string {
  try {
    const decoded = decodeURIComponent(segment);
    if (
      decoded === ".." ||
      decoded === "." ||
      decoded.includes("/") ||
      decoded.includes("\\")
    ) {
      return segment;
    }
    return decoded;
  } catch {
    return segment;
  }
}
