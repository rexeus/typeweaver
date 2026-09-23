import { defineDerivedResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  DerivedResponseCycleError,
  InvalidDerivedResponseError,
} from "../../src/index.js";
import {
  aCanonicalResponse,
  anInlineResponse,
  anOperation,
  aSpec,
  normalizeSpec,
  withDerivedMetadata,
} from "./fixtures.js";

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
