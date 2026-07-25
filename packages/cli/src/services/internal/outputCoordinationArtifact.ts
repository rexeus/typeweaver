const OUTPUT_LOCK_DIRECTORY = ".typeweaver-lock";
const OUTPUT_LOCK_FENCE_PATTERN = /^\.typeweaver-lock\.fence-[0-9a-f]{24}$/;

export const isOutputLockArtifactName = (entryName: string): boolean =>
  entryName === OUTPUT_LOCK_DIRECTORY ||
  OUTPUT_LOCK_FENCE_PATTERN.test(entryName);
