export function jsonPointer(segments: readonly string[]): string {
  if (segments.length === 0) {
    return "";
  }

  return `/${segments.map(escapeJsonPointerSegment).join("/")}`;
}

export function appendJsonPointer(base: string, suffix: string): string {
  if (suffix === "") {
    return base;
  }

  if (base === "") {
    return suffix;
  }

  return `${base}${suffix}`;
}

export function isJsonPointerAtOrBelow(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
