/** @typedef {{ documents: Record<string, string>, runtimeVersion: string }} InstallSnippetOptions */
/** @typedef {{ line: number, text: string }} LogicalLine */

// A package-manager install command, bare or inside inline code. The captured
// arguments stop at the end of the logical line or a closing backtick.
const installCommandPattern =
  /(?:^|[\s`$(])(?:pnpm|npm|yarn|bun)\s+(?:add|install|i)(?=\s|$)([^`\n]*)/gu;
const shellSeparators = new Set(["&&", "||", ";", "|"]);

/**
 * Joins shell line continuations so a multi-line install command is checked as
 * one command, and remembers the first physical line of each logical line.
 *
 * @param {string} content
 * @returns {LogicalLine[]}
 */
const logicalLines = content => {
  /** @type {LogicalLine[]} */
  const lines = [];
  /** @type {LogicalLine | undefined} */
  let pending;
  for (const [index, physical] of content.split(/\r?\n/u).entries()) {
    /** @type {LogicalLine} */
    const current = pending ?? { line: index + 1, text: "" };
    const continued = physical.endsWith("\\");
    current.text += ` ${continued ? physical.slice(0, -1) : physical}`;
    pending = continued ? current : undefined;
    if (!continued) lines.push(current);
  }
  if (pending !== undefined) lines.push(pending);
  return lines;
};

/**
 * @param {string} argumentsText
 * @returns {string[]}
 */
const effectPackageArguments = argumentsText => {
  const tokens = argumentsText.trim().split(/\s+/u);
  const separator = tokens.findIndex(token => shellSeparators.has(token));
  return (separator === -1 ? tokens : tokens.slice(0, separator)).filter(
    token => token === "effect" || token.startsWith("effect@")
  );
};

/**
 * Reports every documented install command that names the `effect` package
 * without the exact native pin, so a copied snippet cannot install a different
 * Effect than the one TypeWeaver requires.
 *
 * @param {InstallSnippetOptions} options
 * @returns {string[]}
 */
export const findUnpinnedEffectInstalls = ({ documents, runtimeVersion }) =>
  Object.entries(documents).flatMap(([document, content]) =>
    logicalLines(content).flatMap(({ line, text }) =>
      Array.from(text.matchAll(installCommandPattern), match =>
        effectPackageArguments(match[1] ?? "")
      )
        .flat()
        .filter(token => token !== `effect@${runtimeVersion}`)
        .map(
          token =>
            `${document}:${line} installs ${token}; pin effect@${runtimeVersion}`
        )
    )
  );
