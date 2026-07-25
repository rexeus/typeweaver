import type { NormalizedSpec } from "@rexeus/typeweaver-gen";

export const emptyNormalizedSpec = (): NormalizedSpec => ({
  resources: [],
  responses: [],
  warnings: [],
});
