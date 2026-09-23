import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import type {
  OperationDefinition,
  SecurityRequirements,
  SecuritySchemeDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { Effect, Result } from "effect";
import { z } from "zod";
import { normalizeSpec } from "../../src/index.js";
import { TestAssertionError } from "../errors/index.js";
import type { NormalizedSpec } from "../../src/index.js";

const successResponse = defineResponse({
  name: "SecuritySuccess",
  statusCode: HttpStatusCode.OK,
  description: "Success",
});

export const anOperation = (
  operationId: string,
  options: {
    readonly security?: SecurityRequirements;
    readonly tags?: readonly string[];
    readonly authorization?: z.ZodString | z.ZodLiteral<string>;
  } = {}
): OperationDefinition =>
  defineOperation({
    operationId,
    method: HttpMethod.GET,
    path: `/${operationId}`,
    summary: operationId,
    description: `${operationId} description`,
    deprecated: operationId === "deprecatedOperation",
    tags: options.tags,
    security: options.security,
    request:
      options.authorization === undefined
        ? {}
        : { header: z.object({ Authorization: options.authorization }) },
    responses: [successResponse],
  });

export const normalize = (spec: SpecDefinition): NormalizedSpec => {
  const result = Effect.runSync(Effect.result(normalizeSpec(spec)));
  if (Result.isSuccess(result)) {
    return result.success;
  }
  throw result.failure;
};

export const failureFrom = (spec: SpecDefinition): unknown => {
  const result = Effect.runSync(Effect.result(normalizeSpec(spec)));
  if (Result.isFailure(result)) {
    return result.failure;
  }
  throw new TestAssertionError("Expected spec normalization to fail.");
};

/** One scheme of every supported kind. */
export const validSchemes = (): readonly SecuritySchemeDefinition[] => [
  { name: "basicAuth", kind: "http", scheme: "basic" },
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
  {
    name: "oauth",
    kind: "oauth2",
    flows: {
      authorizationCode: {
        authorizationUrl: "https://identity.example/authorize",
        tokenUrl: "https://identity.example/token",
        refreshUrl: "https://identity.example/refresh",
        scopes: { "todos:read": "Read todos", "todos:write": "Write todos" },
      },
    },
  },
  {
    name: "oidc",
    kind: "openIdConnect",
    discoveryUrl: "https://identity.example/.well-known/openid-configuration",
  },
];

export const aSpec = (
  overrides: Partial<
    Pick<
      SpecDefinition,
      "metadata" | "security" | "securitySchemes" | "resources"
    >
  > = {}
): SpecDefinition =>
  defineSpec({
    metadata: overrides.metadata ?? {
      title: "Security Test API",
      version: "1.0.0",
      tags: [
        { name: "todos", description: "Todo operations" },
        { name: "admin" },
      ],
    },
    securitySchemes: overrides.securitySchemes ?? validSchemes(),
    security: overrides.security ?? [{ bearerAuth: [] }],
    resources: overrides.resources ?? {
      todo: {
        description: "Todo resource",
        tags: ["todos"],
        operations: [anOperation("listTodos")],
      },
    },
  });
