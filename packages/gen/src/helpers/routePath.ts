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
  const names: string[] = [];
  for (const match of path.matchAll(PATH_PARAMETER_PATTERN)) {
    const name = match[1];
    if (name !== undefined) names.push(name);
  }
  return names;
};
