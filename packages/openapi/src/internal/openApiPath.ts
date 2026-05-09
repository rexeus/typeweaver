export function toOpenApiPath(path: string): string {
  const segments = normalizePathSegments(path).map(segment =>
    segment.replaceAll(pathParameterPattern, "{$1}")
  );

  return `/${segments.join("/")}`;
}

export function getPathParameterNames(path: string): readonly string[] {
  return normalizePathSegments(path).flatMap(segment =>
    Array.from(segment.matchAll(pathParameterPattern), match => match[1] ?? "")
  );
}

const pathParameterPattern = /:([A-Za-z_][A-Za-z0-9_]*)/g;

function normalizePathSegments(path: string): readonly string[] {
  return path.split("/").filter(segment => segment.length > 0);
}
