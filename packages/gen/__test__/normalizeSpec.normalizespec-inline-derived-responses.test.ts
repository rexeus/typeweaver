import {
  defineDerivedResponse,
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
import { describe, expect, test } from "vitest";
import {
  DerivedResponseCycleError,
  InvalidDerivedResponseError,
  normalizeSpec as normalizeSpecEffect,
} from "../src/index.js";
import type { NormalizedSpec } from "../src/index.js";

// Test shim that bridges the legacy sync call surface onto the new Effect
// API. `Effect.result` flattens typed failures into the success channel
// so the existing `toThrowError` / `instanceof` assertions keep working
// against the underlying error rather than Effect's `FiberFailure` wrapper.
const normalizeSpec = (spec: SpecDefinition): NormalizedSpec => {
  const result = Effect.runSync(Effect.result(normalizeSpecEffect(spec)));
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

type ResponseBaseOverrides = {
  readonly statusCode?: HttpStatusCode;
  readonly description?: string;
  readonly header?: ResponseDefinition["header"];
  readonly body?: ResponseDefinition["body"];
};

type InlineResponseOverrides = ResponseBaseOverrides & {
  readonly derived?: NonNullable<ResponseDefinition["derived"]>;
};

type OperationOverrides = {
  readonly operationId?: string;
  readonly method?: HttpMethod;
  readonly path?: string;
  readonly summary?: string;
  readonly request?: RequestDefinition;
  readonly responses?: readonly ResponseDefinition[];
};

const aResponseNameFor = (operationId: string): string => {
  const identifier = operationId.replace(/[^A-Za-z0-9]/gu, "");

  return `${identifier.charAt(0).toUpperCase()}${identifier.slice(1)}Response`;
};

const aCanonicalResponse = (
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

const anInlineResponse = (
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

const anOperation = (overrides: OperationOverrides = {}) => {
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

const testMetadata = {
  title: "Normalization Test API",
  version: "1.0.0",
} as const;

const aSpec = (resources: SpecDefinition["resources"]): SpecDefinition => {
  return defineSpec({ metadata: testMetadata, resources });
};

const withDerivedMetadata = <TResponse extends ResponseDefinition>(
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

describe("normalizeSpec inline derived responses", () => {
  test("keeps an inline derived response local when its canonical parent is present", () => {
    const parentResponse = aCanonicalResponse("ParentResponse");
    const inlineResponse = anInlineResponse("InlineDerivedResponse", {
      derived: {
        parentName: "ParentResponse",
        lineage: ["InlineDerivedResponse"],
        depth: 1,
      },
    });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ responses: [parentResponse, inlineResponse] }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(normalizedSpec.responses.map(response => response.name)).toEqual([
      "ParentResponse",
    ]);
    expect(normalizedSpec.resources[0]?.operations[0]?.responses[1]).toEqual({
      responseName: "InlineDerivedResponse",
      source: "inline",
      response: expect.objectContaining({
        name: "InlineDerivedResponse",
        kind: "derived-response",
        derivedFrom: "ParentResponse",
        lineage: ["InlineDerivedResponse"],
        depth: 1,
      }) as unknown,
    });
  });

  test("keeps an inline derived response local when its parent is a derived canonical response", () => {
    const rootResponse = aCanonicalResponse("RootResponse");
    const childResponse = defineDerivedResponse(rootResponse, {
      name: "ChildResponse",
    });
    const inlineGrandchildResponse = anInlineResponse(
      "InlineGrandchildResponse",
      {
        derived: {
          parentName: "ChildResponse",
          lineage: ["ChildResponse", "InlineGrandchildResponse"],
          depth: 2,
        },
      }
    );
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            responses: [rootResponse, childResponse, inlineGrandchildResponse],
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(normalizedSpec.responses.map(response => response.name)).toEqual([
      "RootResponse",
      "ChildResponse",
    ]);
    expect(normalizedSpec.resources[0]?.operations[0]?.responses[2]).toEqual({
      responseName: "InlineGrandchildResponse",
      source: "inline",
      response: expect.objectContaining({
        name: "InlineGrandchildResponse",
        kind: "derived-response",
        derivedFrom: "ChildResponse",
        lineage: ["ChildResponse", "InlineGrandchildResponse"],
        depth: 2,
      }) as unknown,
    });
  });
});

describe("normalizeSpec derived response metadata", () => {
  test("rejects derived response metadata whose lineage length disagrees with depth", () => {
    const parentResponse = aCanonicalResponse("ParentResponse");
    const childResponse = withDerivedMetadata(
      aCanonicalResponse("ChildResponse"),
      {
        parentName: "ParentResponse",
        lineage: ["ChildResponse"],
        depth: 2,
      }
    );
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ responses: [parentResponse, childResponse] }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidDerivedResponseError);
  });

  test("rejects derived response metadata with empty lineage", () => {
    const parentResponse = aCanonicalResponse("ParentResponse");
    const childResponse = withDerivedMetadata(
      aCanonicalResponse("ChildResponse"),
      {
        parentName: "ParentResponse",
        lineage: [],
        depth: 0,
      }
    );
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ responses: [parentResponse, childResponse] }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidDerivedResponseError);
  });

  test("rejects multi-level derived response metadata whose immediate parent disagrees with lineage", () => {
    const rootResponse = aCanonicalResponse("RootResponse");
    const grandchildResponse = withDerivedMetadata(
      aCanonicalResponse("GrandchildResponse"),
      {
        parentName: "RootResponse",
        lineage: ["IntermediateResponse", "GrandchildResponse"],
        depth: 2,
      }
    );
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ responses: [rootResponse, grandchildResponse] }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidDerivedResponseError);
  });

  test("rejects derived response metadata whose lineage repeats a response name", () => {
    const childResponse = aCanonicalResponse("ChildResponse");
    const grandchildResponse = withDerivedMetadata(
      aCanonicalResponse("GrandchildResponse"),
      {
        parentName: "ChildResponse",
        lineage: ["ChildResponse", "GrandchildResponse", "GrandchildResponse"],
        depth: 3,
      }
    );
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ responses: [childResponse, grandchildResponse] }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
  });
});
