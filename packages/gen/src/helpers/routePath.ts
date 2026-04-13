const PATH_PARAMETER_PATTERN = /:([A-Za-z0-9_]+)/g;

export const normalizeRoutePath = (path: string): string => {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.map(segment => (segment.startsWith(":") ? ":" : segment)).join("/")}`;
};

export const getPathParameterNames = (path: string): string[] => {
  return Array.from(
    path.matchAll(PATH_PARAMETER_PATTERN),
    match => match[1] as string
  );
};
