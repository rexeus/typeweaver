import { describe, expect, test } from "vitest";
import { DefinitionValidator } from "../src/generators/DefinitionValidator";
import { ReservedKeywordError } from "../src/generators/errors/ReservedKeywordError";
import {
  createOperationHelper,
  createResponseHelper,
} from "./helpers";

describe("DefinitionValidator – reserved keyword rejection", () => {
  const SAMPLE_KEYWORDS = [
    "delete", "class", "default", "function", "return",
    "const", "let", "var", "import", "export",
    "interface", "type", "enum", "super", "this",
    "constructor", "eval", "arguments",
  ];

  describe("operationId", () => {
    test.each(SAMPLE_KEYWORDS)(
      "rejects reserved keyword '%s' as operationId",
      (keyword) => {
        const validator = new DefinitionValidator();
        const operation = createOperationHelper(keyword);

        expect(() => validator.validateOperation(operation, "test.ts")).toThrow(
          ReservedKeywordError
        );
      }
    );

    test.each(SAMPLE_KEYWORDS)(
      "ReservedKeywordError has correct properties for operationId '%s'",
      (keyword) => {
        const validator = new DefinitionValidator();
        const operation = createOperationHelper(keyword);

        try {
          validator.validateOperation(operation, "test.ts");
          expect.unreachable("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(ReservedKeywordError);
          const rke = error as ReservedKeywordError;
          expect(rke.entityType).toBe("operationId");
          expect(rke.identifier).toBe(keyword);
          expect(rke.file).toBe("test.ts");
        }
      }
    );
  });

  describe("response name", () => {
    test.each(SAMPLE_KEYWORDS)(
      "rejects reserved keyword '%s' as response name",
      (keyword) => {
        const validator = new DefinitionValidator();
        const response = createResponseHelper(keyword);

        expect(() => validator.validateResponse(response, "test.ts")).toThrow(
          ReservedKeywordError
        );
      }
    );

    test.each(SAMPLE_KEYWORDS)(
      "ReservedKeywordError has correct properties for response name '%s'",
      (keyword) => {
        const validator = new DefinitionValidator();
        const response = createResponseHelper(keyword);

        try {
          validator.validateResponse(response, "test.ts");
          expect.unreachable("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(ReservedKeywordError);
          const rke = error as ReservedKeywordError;
          expect(rke.entityType).toBe("responseName");
          expect(rke.identifier).toBe(keyword);
          expect(rke.file).toBe("test.ts");
        }
      }
    );
  });

  describe("valid identifiers accepted", () => {
    test.each(["deleteTodo", "Delete", "myClass", "getItems", "listUsers"])(
      "accepts valid identifier '%s' as operationId",
      (name) => {
        const validator = new DefinitionValidator();
        const operation = createOperationHelper(name);

        expect(() =>
          validator.validateOperation(operation, "test.ts")
        ).not.toThrow();
      }
    );

    test.each(["Success", "NotFound", "DeleteResult", "MyType", "Created"])(
      "accepts valid identifier '%s' as response name",
      (name) => {
        const validator = new DefinitionValidator();
        const response = createResponseHelper(name);

        expect(() =>
          validator.validateResponse(response, "test.ts")
        ).not.toThrow();
      }
    );
  });
});
