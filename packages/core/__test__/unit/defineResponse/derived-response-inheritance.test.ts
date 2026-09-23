import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  defineDerivedResponse,
  defineResponse,
  getResponseDefinitionMetadata,
  isNamedResponseDefinition,
} from "../../../src/defineResponse.js";
import { HttpStatusCode } from "../../../src/HttpStatusCode.js";

describe("defineDerivedResponse metadata and lineage", () => {
  test("derived responses expose define-derived-response metadata", () => {
    const base = defineResponse({
      name: "BaseResponse",
      statusCode: HttpStatusCode.OK,
      description: "Base response",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(getResponseDefinitionMetadata(child)).toEqual({
      source: "define-derived-response",
    });
  });

  test("derived responses are recognized as named responses", () => {
    const base = defineResponse({
      name: "BaseResponse",
      statusCode: HttpStatusCode.OK,
      description: "Base response",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(isNamedResponseDefinition(child)).toBe(true);
  });

  test("first-level derived responses record parent name and lineage depth", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });

    const child = defineDerivedResponse(base, {
      name: "ValidationError",
    });

    expect(child.derived).toEqual({
      parentName: "BaseError",
      lineage: ["ValidationError"],
      depth: 1,
    });
  });

  test("nested derived responses record lineage through each derivation", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });
    const validationError = defineDerivedResponse(base, {
      name: "ValidationError",
    });

    const signupValidationError = defineDerivedResponse(validationError, {
      name: "SignupValidationError",
    });

    expect(signupValidationError.derived).toEqual({
      parentName: "ValidationError",
      lineage: ["ValidationError", "SignupValidationError"],
      depth: 2,
    });
  });
});

describe("defineDerivedResponse scalar inheritance", () => {
  test("derived responses inherit parent description when only status is overridden", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });

    const child = defineDerivedResponse(base, {
      name: "ValidationError",
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
    });

    expect(child.description).toBe("Base error");
  });

  test("derived responses use supplied description over parent description", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });

    const child = defineDerivedResponse(base, {
      name: "ValidationError",
      description: "Validation error",
    });

    expect(child.description).toBe("Validation error");
  });

  test("derived responses use supplied status over parent status", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });

    const child = defineDerivedResponse(base, {
      name: "ValidationError",
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
    });

    expect(child.statusCode).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
  });
});

describe("defineDerivedResponse omitted fields", () => {
  test("inherits parent statusCode and description when not overridden", () => {
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.NOT_FOUND,
      description: "Not found",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(child.statusCode).toBe(HttpStatusCode.NOT_FOUND);
    expect(child.description).toBe("Not found");
  });

  test("inherits parent body when child omits body", () => {
    const body = z.object({ id: z.string() });
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
      body,
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(child.body).toBe(body);
  });

  test("inherits parent header when child omits header", () => {
    const header = z.object({ "x-request-id": z.string() });
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
      header,
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(child.header).toBe(header);
  });

  test("uses child body when parent omits body", () => {
    const body = z.object({ id: z.string() });
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
      body,
    });

    expect(child.body).toBe(body);
  });

  test("uses child header when parent omits header", () => {
    const header = z.object({ "x-request-id": z.string() });
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
      header,
    });

    expect(child.header).toBe(header);
  });
});
