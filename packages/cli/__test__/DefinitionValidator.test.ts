import { describe, expect, test } from "vitest";
import { DefinitionValidator } from "../src/generators/DefinitionValidator";
import { ReservedKeywordError } from "../src/generators/errors/ReservedKeywordError";
import { catchError, createOperation, createResponse } from "./helpers";

describe("DefinitionValidator – reserved keyword rejection", () => {
  const SAMPLE_KEYWORDS = [
    "delete", "class", "default", "function", "return",
    "const", "let", "var", "import", "export",
    "interface", "type", "enum", "super", "this",
    "constructor", "eval", "arguments",
  ];

  describe("operationId", () => {
    test.each(SAMPLE_KEYWORDS)(
      "rejects '%s' as operationId",
      (keyword) => {
        const validator = new DefinitionValidator();
        const operation = createOperation(keyword);

        const error = catchError(() =>
          validator.validateOperation(operation, "test.ts")
        ) as ReservedKeywordError;

        expect(error).toBeInstanceOf(ReservedKeywordError);
        expect(error.entityType).toBe("operationId");
        expect(error.identifier).toBe(keyword);
        expect(error.file).toBe("test.ts");
      }
    );
  });

  describe("response name", () => {
    test.each(SAMPLE_KEYWORDS)(
      "rejects '%s' as response name",
      (keyword) => {
        const validator = new DefinitionValidator();
        const response = createResponse(keyword);

        const error = catchError(() =>
          validator.validateResponse(response, "test.ts")
        ) as ReservedKeywordError;

        expect(error).toBeInstanceOf(ReservedKeywordError);
        expect(error.entityType).toBe("responseName");
        expect(error.identifier).toBe(keyword);
        expect(error.file).toBe("test.ts");
      }
    );
  });

  describe("valid identifiers", () => {
    test.each(["deleteTodo", "Delete", "myClass", "getItems", "listUsers"])(
      "accepts '%s' as operationId",
      (name) => {
        const validator = new DefinitionValidator();
        const operation = createOperation(name);

        expect(() =>
          validator.validateOperation(operation, "test.ts")
        ).not.toThrow();
      }
    );

    test.each(["Success", "NotFound", "DeleteResult", "MyType", "Created"])(
      "accepts '%s' as response name",
      (name) => {
        const validator = new DefinitionValidator();
        const response = createResponse(name);

        expect(() =>
          validator.validateResponse(response, "test.ts")
        ).not.toThrow();
      }
    );
  });
});
