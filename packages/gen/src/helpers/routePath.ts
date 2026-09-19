const PATH_PARAMETER_PATTERN = /:([A-Za-z0-9_]+)/g;

export const normalizeRoutePath = (path: string): string => {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return "/";
  }

  return JSON.stringify(
    segments.map(segment => {
      const tokens: Array<readonly ["literal", string] | readonly ["param"]> =
        [];
      let cursor = 0;

      for (const match of segment.matchAll(PATH_PARAMETER_PATTERN)) {
        const offset = match.index;
        if (offset > cursor) {
          tokens.push(["literal", segment.slice(cursor, offset)]);
        }
        tokens.push(["param"]);
        cursor = offset + match[0].length;
      }

      if (cursor < segment.length) {
        tokens.push(["literal", segment.slice(cursor)]);
      }

      return tokens;
    })
  );
};

export const getPathParameterNames = (path: string): string[] => {
  return Array.from(
    path.matchAll(PATH_PARAMETER_PATTERN),
    match => match[1] as string
  );
};
