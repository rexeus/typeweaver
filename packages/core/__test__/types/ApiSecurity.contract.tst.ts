import { expectTypeOf } from "vitest";
import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "../../src/index.js";
import type {
  ApiMetadataDefinition,
  SecurityRequirement,
  SecuritySchemeDefinition,
  SpecDefinition,
} from "../../src/index.js";

const metadata = {
  title: "Contract API",
  version: "1.0.0",
  description: "Generator-neutral metadata",
  tags: [{ name: "todos", description: "Todo operations" }],
} as const satisfies ApiMetadataDefinition;

const schemes = [
  {
    name: "bearerAuth",
    kind: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
  {
    name: "apiKey",
    kind: "apiKey",
    credentialName: "x-api-key",
    location: "header",
  },
] as const satisfies readonly SecuritySchemeDefinition[];

const authenticated = [
  { bearerAuth: [], apiKey: [] },
] as const satisfies readonly SecurityRequirement[];

const response = defineResponse({
  name: "ContractSuccess",
  statusCode: HttpStatusCode.OK,
  description: "Success",
});

const operation = defineOperation({
  operationId: "readContract",
  method: HttpMethod.GET,
  path: "/contract",
  summary: "Read contract",
  description: "Operation description",
  deprecated: true,
  tags: ["todos"],
  security: [],
  request: {},
  responses: [response],
});

const spec = defineSpec({
  metadata,
  securitySchemes: schemes,
  security: authenticated,
  resources: {
    contract: {
      description: "Resource description",
      tags: ["todos"],
      security: [{ bearerAuth: [] }],
      operations: [operation],
    },
  },
});

expectTypeOf(spec.metadata).toEqualTypeOf<typeof metadata>();
expectTypeOf(spec.securitySchemes).toEqualTypeOf<typeof schemes>();
expectTypeOf(spec.resources.contract.operations[0].security).toEqualTypeOf<
  readonly []
>();
expectTypeOf<{ readonly resources: {} }>().not.toMatchTypeOf<SpecDefinition>();
