import type { NormalizedSpec } from "@rexeus/typeweaver-gen";

export const emptyNormalizedSpec = (): NormalizedSpec => ({
  metadata: { title: "Empty API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [],
  responses: [],
  warnings: [],
});
