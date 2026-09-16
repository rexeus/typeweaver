const metadataFieldPattern = /^[A-Za-z][A-Za-z0-9-]*$/;

export const deriveMetadataFields = apiMetadataSource => {
  const block =
    /export type ApiMetadataDefinition = \{([\s\S]*?)\n\};/.exec(
      apiMetadataSource
    )?.[1] ?? "";
  return [
    ...new Set(
      Array.from(block.matchAll(/readonly (\w+)\??:/g), match => match[1])
    ),
  ];
};

export const extractMetadataProjectionFields = documentSource => {
  const paragraph = documentSource
    .split(/\n{2,}/)
    .find(part => part.includes("defineSpec({ metadata: ... })"));
  if (paragraph === undefined) {
    return [];
  }
  // Split on sentence-final periods only: a period preceded by another period is
  // part of an ellipsis such as `metadata: ...`.
  const sentence = paragraph
    .split(/(?<!\.)\.\s+/)
    .find(part => part.includes("defineSpec({ metadata: ... })"));
  if (sentence === undefined) {
    return [];
  }
  return [
    ...new Set(
      Array.from(sentence.matchAll(/`([^`]+)`/g), match => match[1]).filter(
        token => metadataFieldPattern.test(token)
      )
    ),
  ];
};

export const metadataProjectionMatches = ({
  apiMetadataSource,
  documentSource,
}) => {
  const expected = deriveMetadataFields(apiMetadataSource);
  if (expected.length === 0) {
    return false;
  }
  const actual = extractMetadataProjectionFields(documentSource);
  return (
    expected.length === actual.length &&
    expected.every(field => actual.includes(field))
  );
};
