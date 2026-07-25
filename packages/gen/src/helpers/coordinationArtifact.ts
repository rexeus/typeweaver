export const TYPEWEAVER_COORDINATION_MARKER_FILE = ".typeweaver-coordination";

export const ATOMIC_WRITE_TEMP_DIRECTORY_PREFIX = ".typeweaver-";

export const SPEC_BUNDLER_TEMP_DIRECTORY_PREFIX = ".typeweaver-spec-loader-";

export type TypeweaverCoordinationArtifactKind =
  | "atomic-write-temp"
  | "spec-bundler-temp";

const COORDINATION_PROTOCOL = "typeweaver-coordination-artifact/v1";
const NODE_TEMP_DIRECTORY_RANDOM_SUFFIX_LENGTH = 6;

export const coordinationArtifactMarkerSource = (
  kind: TypeweaverCoordinationArtifactKind
): string => `${COORDINATION_PROTOCOL}\nkind=${kind}\n`;

export const matchesCoordinationArtifactMarker = (
  source: string,
  kind: TypeweaverCoordinationArtifactKind
): boolean => source === coordinationArtifactMarkerSource(kind);

const isAsciiAlphaNumeric = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
};

const hasNodeTempDirectoryShape = (
  entryName: string,
  prefix: string
): boolean => {
  if (
    !entryName.startsWith(prefix) ||
    entryName.length !==
      prefix.length + NODE_TEMP_DIRECTORY_RANDOM_SUFFIX_LENGTH
  ) {
    return false;
  }

  return Array.from(entryName.slice(prefix.length)).every(isAsciiAlphaNumeric);
};

/**
 * Classifies names created by Node's `mkdtemp` for Typeweaver staging.
 *
 * A matching name is only a candidate. Destructive cleanup and formatter
 * exclusion must additionally verify the exact marker file for the returned
 * kind; the name alone is never evidence of Typeweaver ownership.
 */
export const coordinationArtifactKindForTempDirectoryName = (
  entryName: string
): TypeweaverCoordinationArtifactKind | undefined => {
  if (
    hasNodeTempDirectoryShape(entryName, SPEC_BUNDLER_TEMP_DIRECTORY_PREFIX)
  ) {
    return "spec-bundler-temp";
  }
  if (
    hasNodeTempDirectoryShape(entryName, ATOMIC_WRITE_TEMP_DIRECTORY_PREFIX)
  ) {
    return "atomic-write-temp";
  }
  return undefined;
};
