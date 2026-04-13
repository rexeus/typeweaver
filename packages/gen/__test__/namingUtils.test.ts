import { describe, expect, test } from "vitest";
import {
  isCamelCase,
  isPascalCase,
  isSupportedOperationId,
  isSupportedResourceName,
} from "../src/helpers/namingUtils.js";

describe("namingUtils", () => {
  describe("isCamelCase", () => {
    test("accepts camelCase names", () => {
      expect(isCamelCase("getUser")).toBe(true);
      expect(isCamelCase("x")).toBe(true);
      expect(isCamelCase("oauth2Callback")).toBe(true);
    });

    test("rejects unsupported or non-camelCase names", () => {
      expect(isCamelCase("GetUser")).toBe(false);
      expect(isCamelCase("get_user")).toBe(false);
      expect(isCamelCase("get-user")).toBe(false);
      expect(isCamelCase("")).toBe(false);
    });
  });

  describe("isPascalCase", () => {
    test("accepts PascalCase names", () => {
      expect(isPascalCase("GetUser")).toBe(true);
      expect(isPascalCase("X")).toBe(true);
      expect(isPascalCase("OAuth2Callback")).toBe(true);
    });

    test("rejects unsupported or non-PascalCase names", () => {
      expect(isPascalCase("getUser")).toBe(false);
      expect(isPascalCase("Get_User")).toBe(false);
      expect(isPascalCase("Get-User")).toBe(false);
      expect(isPascalCase("")).toBe(false);
    });
  });

  describe("supported identifiers", () => {
    test("accept supported operation IDs", () => {
      expect(isSupportedOperationId("getUser")).toBe(true);
      expect(isSupportedOperationId("GetUser")).toBe(true);
      expect(isSupportedOperationId("v2UserLookup")).toBe(true);
    });

    test("reject unsupported operation IDs", () => {
      expect(isSupportedOperationId("get_user")).toBe(false);
      expect(isSupportedOperationId("get-user")).toBe(false);
      expect(isSupportedOperationId("get_user-item")).toBe(false);
    });

    test("accept supported resource names", () => {
      expect(isSupportedResourceName("user")).toBe(true);
      expect(isSupportedResourceName("users")).toBe(true);
      expect(isSupportedResourceName("User")).toBe(true);
    });

    test("reject unsupported resource names", () => {
      expect(isSupportedResourceName("user_profile")).toBe(false);
      expect(isSupportedResourceName("user-profile")).toBe(false);
    });
  });
});
