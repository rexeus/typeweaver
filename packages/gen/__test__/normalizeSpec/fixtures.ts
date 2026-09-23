import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import type {
  RequestDefinition,
  ResponseDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { Effect, Result } from "effect";
import { normalizeSpec as normalizeSpecEffect } from "../../src/index.js";
import { TestAssertionError } from "../errors/index.js";
import type { NormalizedSpec } from "../../src/index.js";

// Test shim that bridges the legacy sync call surface onto the new Effect
// API. `Effect.result` flattens typed failures into the success channel
// so the existing `toThrowError` / `instanceof` assertions keep working
// against the underlying error rather than Effect's `FiberFailure` wrapper.
export const normalizeSpec = (spec: SpecDefinition): NormalizedSpec => {
  const result = Effect.runSync(Effect.result(normalizeSpecEffect(spec)));
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

// Capture the typed failure from `normalizeSpecEffect` without rethrowing
// so tests can assert on discriminating fields (resourceName, operationId,
// etc.) — not just the error class.
export const captureNormalizeError = (spec: SpecDefinition): unknown => {
  const result = Effect.runSync(Effect.result(normalizeSpecEffect(spec)));
  if (Result.isSuccess(result)) {
    throw new Error("Expected normalization to fail but it succeeded");
  }
  return result.failure;
};

export type ResponseBaseOverrides = {
  readonly statusCode?: HttpStatusCode;
  readonly description?: string;
  readonly header?: ResponseDefinition["header"];
  readonly body?: ResponseDefinition["body"];
};

export type InlineResponseOverrides = ResponseBaseOverrides & {
  readonly derived?: NonNullable<ResponseDefinition["derived"]>;
};

export type OperationOverrides = {
  readonly operationId?: string;
  readonly method?: HttpMethod;
  readonly path?: string;
  readonly summary?: string;
  readonly request?: RequestDefinition;
  readonly responses?: readonly ResponseDefinition[];
};

export const aResponseNameFor = (operationId: string): string => {
  const identifier = operationId.replace(/[^A-Za-z0-9]/gu, "");

  return `${identifier.charAt(0).toUpperCase()}${identifier.slice(1)}Response`;
};

export const aCanonicalResponse = (
  name = "OkResponse",
  overrides: ResponseBaseOverrides = {}
): ResponseDefinition => {
  return defineResponse({
    name,
    statusCode: overrides.statusCode ?? HttpStatusCode.OK,
    description: overrides.description ?? `${name} description`,
    header: overrides.header,
    body: overrides.body,
  });
};

export const anInlineResponse = (
  name = "InlineResponse",
  overrides: InlineResponseOverrides = {}
): ResponseDefinition => {
  return {
    name,
    statusCode: overrides.statusCode ?? HttpStatusCode.BAD_REQUEST,
    description: overrides.description ?? `${name} description`,
    header: overrides.header,
    body: overrides.body,
    derived: overrides.derived,
  };
};

export const anOperation = (overrides: OperationOverrides = {}) => {
  const operationId = overrides.operationId ?? "getTodo";

  return defineOperation({
    operationId,
    method: overrides.method ?? HttpMethod.GET,
    path: overrides.path ?? "/todos",
    summary: overrides.summary ?? `${operationId} summary`,
    request: overrides.request ?? {},
    responses: overrides.responses ?? [
      aCanonicalResponse(aResponseNameFor(operationId)),
    ],
  });
};

export const testMetadata = {
  title: "Normalization Test API",
  version: "1.0.0",
} as const;

export const aSpec = (
  resources: SpecDefinition["resources"]
): SpecDefinition => {
  return defineSpec({ metadata: testMetadata, resources });
};

export const aMalformedSpec = (
  resources: SpecDefinition["resources"]
): SpecDefinition => {
  return { metadata: testMetadata, resources };
};

export const theOnlyOperationIn = (
  normalizedSpec: ReturnType<typeof normalizeSpec>
) => {
  const operation = normalizedSpec.resources[0]?.operations[0];

  if (operation === undefined) {
    throw new TestAssertionError(
      "Expected the normalized spec to contain one operation."
    );
  }

  return operation;
};

export const withDerivedMetadata = <TResponse extends ResponseDefinition>(
  response: TResponse,
  metadata: NonNullable<ResponseDefinition["derived"]>
): TResponse => {
  Object.defineProperty(response, "derived", {
    value: metadata,
    enumerable: true,
    configurable: true,
    writable: true,
  });

  return response;
};
