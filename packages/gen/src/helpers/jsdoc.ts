export type CreateJSDocCommentOptions = {
  readonly indentation?: string;
};

const BLOCK_COMMENT_END_PATTERN = /\*\//g;
const LINE_BREAK_PATTERN = /\r\n?/g;

export function createJSDocComment(
  text: string | undefined,
  options: CreateJSDocCommentOptions = {}
): string | undefined {
  const normalizedText = text?.replace(LINE_BREAK_PATTERN, "\n");
  const trimmedText = normalizedText?.trim();

  if (!trimmedText) return undefined;

  const indentation = options.indentation ?? "";
  const lines = trimmedText
    .replace(BLOCK_COMMENT_END_PATTERN, "*\\/")
    .split("\n");

  return [
    `${indentation}/**`,
    ...lines.map(line => `${indentation} * ${line}`),
    `${indentation} */`,
  ].join("\n");
}
