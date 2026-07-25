import type { TemplateData } from "../plugins/contextTypes.js";

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

type TemplateTag = {
  readonly end: number;
  readonly start: number;
  readonly value: string;
};

function findNextTemplateTag(
  template: string,
  fromIndex: number
): TemplateTag | undefined {
  const start = template.indexOf("<%", fromIndex);
  if (start === -1) {
    return undefined;
  }

  const closingStart = template.indexOf("%>", start + 2);
  if (closingStart === -1) {
    return undefined;
  }

  const end = closingStart + 2;
  return {
    start,
    end,
    value: template.slice(start, end),
  };
}

export function renderTemplate(template: string, data: TemplateData): string {
  const templateData = data ?? {};
  const outputChunks: string[] = [];
  let currentIndex = 0;
  let tagLocation = findNextTemplateTag(template, currentIndex);

  while (tagLocation !== undefined) {
    const { end: tagEnd, start: tagStart, value: tag } = tagLocation;

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

    currentIndex = tagEnd;
    tagLocation = findNextTemplateTag(template, currentIndex);
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
    data: NonNullable<TemplateData>,
    escape: typeof escapeHtml,
    stringify: typeof stringifyTemplateValue
  ) => string;

  return render(templateData, escapeHtml, stringifyTemplateValue);
}
