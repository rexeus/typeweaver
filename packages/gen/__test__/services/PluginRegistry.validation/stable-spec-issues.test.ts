import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  DuplicateOperationIdError,
  NORMALIZED_SPEC_WARNING_REGISTRY,
  normalizationErrorToIssue,
  normalizedSpecWarningToIssue,
  SPEC_ISSUE_REGISTRY,
} from "../../../src/index.js";
import { normalizedSpec } from "./fixtures.js";
import type { NormalizedSpec } from "../../../src/index.js";

const normalizedWarningSpec: NormalizedSpec = {
  ...normalizedSpec,
  resources: [
    {
      name: "todos",
      tags: [],
      security: { requirements: [], source: "none" },
      operations: [
        {
          operationId: "createTodo",
          method: HttpMethod.POST,
          path: "/todos",
          summary: "Create a todo",
          deprecated: false,
          tags: [],
          security: { requirements: [], source: "none" },
          responses: [
            {
              responseName: "InlineTodoCreated",
              source: "inline",
              response: {
                name: "InlineTodoCreated",
                statusCode: HttpStatusCode.CREATED,
                statusCodeName: "CREATED",
                description: "Todo created",
                kind: "response",
              },
            },
          ],
        },
      ],
    },
  ],
  responses: [
    {
      name: "TodoCreated",
      statusCode: HttpStatusCode.CREATED,
      statusCodeName: "CREATED",
      description: "Todo created",
      kind: "response",
    },
  ],
};

describe("stable spec issue registry", () => {
  test("uses unique sequential codes for every normalization error tag", () => {
    const entries = Object.values(SPEC_ISSUE_REGISTRY);

    expect(entries.map(entry => entry.code)).toEqual(
      entries.map(
        (_entry, index) => `TW-SPEC-${String(index + 1).padStart(3, "0")}`
      )
    );
    expect(new Set(entries.map(entry => entry.code)).size).toBe(entries.length);
  });

  test("maps known errors to issues and leaves unknown errors unmapped", () => {
    const known = normalizationErrorToIssue(
      new DuplicateOperationIdError({ operationId: "getTodo" })
    );

    expect(known).toMatchObject({
      code: "TW-SPEC-003",
      severity: "error",
      path: "/resources",
      fixable: false,
    });
    expect(normalizationErrorToIssue(new Error("unknown"))).toBeUndefined();
  });

  test("maps every normalized warning to a stable warning issue", () => {
    expect(
      Object.values(NORMALIZED_SPEC_WARNING_REGISTRY).map(entry => entry.code)
    ).toEqual(["TW-SPEC-101", "TW-SPEC-102", "TW-SPEC-103"]);
    expect(
      normalizedSpecWarningToIssue(
        {
          code: "missing-content-type-header",
          message: "Missing Content-Type",
          location: {
            part: "request.body",
            resourceName: "todos",
            operationId: "createTodo",
          },
        },
        normalizedWarningSpec
      )
    ).toEqual({
      code: "TW-SPEC-102",
      severity: "warning",
      message: "Missing Content-Type",
      path: "/resources/0/operations/0/request/body",
      hint: "Declare a literal Content-Type header so generators can represent the body media type.",
      fixable: false,
    });
  });

  test("maps inline and canonical response warnings to their body contracts", () => {
    const baseWarning = {
      code: "missing-content-type-header",
      message: "Missing Content-Type",
    } as const;

    expect(
      normalizedSpecWarningToIssue(
        {
          ...baseWarning,
          location: {
            part: "response.body",
            resourceName: "todos",
            operationId: "createTodo",
            responseName: "InlineTodoCreated",
            statusCode: HttpStatusCode.CREATED,
          },
        },
        normalizedWarningSpec
      ).path
    ).toBe("/resources/0/operations/0/responses/0/response/body");
    expect(
      normalizedSpecWarningToIssue(
        {
          ...baseWarning,
          location: {
            part: "response.body",
            responseName: "TodoCreated",
            statusCode: HttpStatusCode.CREATED,
          },
        },
        normalizedWarningSpec
      ).path
    ).toBe("/responses/0/body");
  });
});
