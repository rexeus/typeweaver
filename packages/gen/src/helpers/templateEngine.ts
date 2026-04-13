function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stringifyTemplateValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

export function renderTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  const outputChunks: string[] = [];
  const expressionPattern = /<%[=-]?[\s\S]*?%>/g;
  let currentIndex = 0;
  let match: RegExpExecArray | null = expressionPattern.exec(template);

  while (match !== null) {
    const [tag] = match;
    const tagStart = match.index;

    outputChunks.push(
      `__output.push(${JSON.stringify(template.slice(currentIndex, tagStart))});`
    );

    if (tag.startsWith("<%=")) {
      const expression = tag.slice(3, -2).trim();
      outputChunks.push(`__output.push(__escape(__stringify(${expression})));`);
    } else if (tag.startsWith("<%-")) {
      const expression = tag.slice(3, -2).trim();
      outputChunks.push(`__output.push(__stringify(${expression}));`);
    } else {
      outputChunks.push(tag.slice(2, -2));
    }

    currentIndex = tagStart + tag.length;
    match = expressionPattern.exec(template);
  }

  outputChunks.push(
    `__output.push(${JSON.stringify(template.slice(currentIndex))});`
  );

  const render = new Function(
    "data",
    "__escape",
    "__stringify",
    // This intentionally relies on `new Function()` sloppy mode so `with (data)`
    // can expose template variables as bare identifiers during rendering.
    // The tests pin the expected collision behavior: own properties on `data`
    // (including names like `name` or `toString`) must win over outer built-ins.
    `const __output = []; with (data) { ${outputChunks.join("\n")} } return __output.join("");`
  ) as (
    data: Record<string, unknown>,
    escape: typeof escapeHtml,
    stringify: typeof stringifyTemplateValue
  ) => string;

  return render(data, escapeHtml, stringifyTemplateValue);
}
