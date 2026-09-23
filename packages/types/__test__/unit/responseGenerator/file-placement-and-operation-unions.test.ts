import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { generate } from "../../../src/responseGenerator.js";
import {
  aCanonicalResponse,
  aCanonicalResponseUsage,
  anInlineOperationResponse,
  anInlineResponseUsage,
  anOperationWithResponses,
  aNormalizedSpecWith,
  aResourceWithOperationResponses,
  createResponseGeneratorContext,
  getGeneratedSource,
  renderResponseSources,
} from "./fixtures.js";
import type { ResponseGeneratorTestContext } from "./fixtures.js";

function aDataCapturingResponseGeneratorContext(
  normalizedSpec: NormalizedSpec
): ResponseGeneratorTestContext {
  return createResponseGeneratorContext(normalizedSpec, (_templatePath, data) =>
    JSON.stringify(data)
  );
}

function captureResponseGeneratorData(
  normalizedSpec: NormalizedSpec
): Map<string, string> {
  const { context, writtenFiles } =
    aDataCapturingResponseGeneratorContext(normalizedSpec);

  generate(context);

  return writtenFiles;
}

function parseGeneratedData(
  writtenFiles: Map<string, string>,
  relativePath: string
): unknown {
  const content = writtenFiles.get(relativePath);
  if (content === undefined) {
    throw new TestAssertionError(`Expected ${relativePath} to be generated`);
  }

  return JSON.parse(content);
}

describe("ResponseGenerator file placement and operation unions", () => {
  test("emits canonical responses separately from inline operation responses", () => {
    const sharedError = aCanonicalResponse();
    const createTodoSuccess = anInlineOperationResponse();
    const normalizedSpec: NormalizedSpec = aNormalizedSpecWith({
      responses: [sharedError],
      resources: [
        {
          name: "todos",
          tags: [],
          security: { requirements: [], source: "none" },
          operations: [
            anOperationWithResponses([
              aCanonicalResponseUsage(sharedError.name),
              anInlineResponseUsage(createTodoSuccess),
            ]),
          ],
        },
      ],
    });

    const writtenFiles = captureResponseGeneratorData(normalizedSpec);

    expect(writtenFiles.has("responses/SharedErrorResponse.ts")).toBe(true);
    expect(writtenFiles.has("responses/CreateTodoSuccessResponse.ts")).toBe(
      false
    );
    expect(writtenFiles.has("todos/CreateTodoResponse.ts")).toBe(true);
    expect(
      parseGeneratedData(writtenFiles, "responses/SharedErrorResponse.ts")
    ).toEqual(
      expect.objectContaining({
        identifierName: "SharedError",
        typeValue: "SharedError",
        statusCodeKey: "BAD_REQUEST",
      })
    );
    expect(
      parseGeneratedData(writtenFiles, "todos/CreateTodoResponse.ts")
    ).toEqual(
      expect.objectContaining({
        operationId: "createTodo",
        ownResponses: [
          expect.objectContaining({
            identifierName: "CreateTodoSuccess",
            typeValue: "CreateTodoSuccess",
            statusCode: HttpStatusCode.CREATED,
            statusCodeKey: "CREATED",
          }),
        ],
        sharedResponses: [
          {
            identifierName: "SharedError",
            path: "../responses/SharedErrorResponse",
          },
        ],
      })
    );
  });

  test("renders operation response unions from inline and shared responses", () => {
    const sharedError = aCanonicalResponse();
    const createTodoSuccess = anInlineOperationResponse();
    const normalizedSpec: NormalizedSpec = aNormalizedSpecWith({
      responses: [sharedError],
      resources: [
        aResourceWithOperationResponses([
          anInlineResponseUsage(createTodoSuccess),
          aCanonicalResponseUsage(sharedError.name),
        ]),
      ],
    });

    const writtenFiles = renderResponseSources(normalizedSpec);
    const source = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );

    expect(source).toContain("export type ICreateTodoSuccessResponse");
    expect(source).toContain(
      'import type { ISharedErrorResponse } from "../responses/SharedErrorResponse";'
    );
    expect(source).toMatch(
      /export type CreateTodoResponse =\s*\| ICreateTodoSuccessResponse\s*\| ISharedErrorResponse\s*;/
    );
  });
});
