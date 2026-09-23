import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  aCanonicalResponse,
  aCanonicalResponseUsage,
  anInlineOperationResponse,
  anInlineResponseUsage,
  aNormalizedSpecWith,
  aResourceWithOperationResponses,
  getGeneratedSource,
  renderResponseSources,
} from "./fixtures.js";

describe("ResponseGenerator derived responses", () => {
  test("renders canonical derived responses as shared response files", () => {
    const todoNotFoundError = aCanonicalResponse({
      name: "TodoNotFoundError",
      kind: "derived-response",
      derivedFrom: "NotFoundError",
      lineage: ["TodoNotFoundError"],
      depth: 1,
      statusCode: HttpStatusCode.NOT_FOUND,
      statusCodeName: "NOT_FOUND",
      header: z.object({ "x-reason": z.string() }),
      body: z.object({ message: z.string(), todoId: z.string() }),
    });

    const writtenFiles = renderResponseSources(
      aNormalizedSpecWith({
        responses: [todoNotFoundError],
        resources: [],
      })
    );
    const source = getGeneratedSource(
      writtenFiles,
      "responses/TodoNotFoundErrorResponse.ts"
    );

    expect(source).toContain("export type ITodoNotFoundErrorResponseHeader");
    expect(source).toContain("export type ITodoNotFoundErrorResponseBody");
    expect(source).toMatch(/ITypedHttpResponse<\s*"TodoNotFoundError"/);
    expect(source).toContain("HttpStatusCode.NOT_FOUND");
    expect(source).toContain("export const createTodoNotFoundErrorResponse");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: input.body");
  });

  test("keeps inline derived responses operation-local when mixed with a canonical parent", () => {
    const notFoundError = aCanonicalResponse({
      name: "NotFoundError",
      statusCode: HttpStatusCode.NOT_FOUND,
      statusCodeName: "NOT_FOUND",
    });
    const todoNotFoundError = anInlineOperationResponse({
      name: "TodoNotFoundError",
      kind: "derived-response",
      derivedFrom: "NotFoundError",
      lineage: ["TodoNotFoundError"],
      depth: 1,
      statusCode: HttpStatusCode.NOT_FOUND,
      statusCodeName: "NOT_FOUND",
      header: z.object({ "x-reason": z.string() }),
      body: z.object({ message: z.string(), todoId: z.string() }),
    });
    const normalizedSpec: NormalizedSpec = aNormalizedSpecWith({
      responses: [notFoundError],
      resources: [
        aResourceWithOperationResponses([
          aCanonicalResponseUsage(notFoundError.name),
          anInlineResponseUsage(todoNotFoundError),
        ]),
      ],
    });

    const writtenFiles = renderResponseSources(normalizedSpec);
    const source = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );

    expect(source).toContain(
      'import type { INotFoundErrorResponse } from "../responses/NotFoundErrorResponse";'
    );
    expect(source).toContain("export type ITodoNotFoundErrorResponseHeader");
    expect(source).toContain("export type ITodoNotFoundErrorResponseBody");
    expect(source).toContain("export const createTodoNotFoundErrorResponse");
    expect(source).toMatch(/ITypedHttpResponse<\s*"TodoNotFoundError"/);
    expect(source).toMatch(
      /export type CreateTodoResponse =\s*\| ITodoNotFoundErrorResponse\s*\| INotFoundErrorResponse\s*;/
    );
    expect(writtenFiles.has("responses/NotFoundErrorResponse.ts")).toBe(true);
    expect(writtenFiles.has("responses/TodoNotFoundErrorResponse.ts")).toBe(
      false
    );
  });
});
