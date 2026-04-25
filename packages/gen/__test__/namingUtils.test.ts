import { describe, expect, test } from "vitest";
import {
  isSupportedOperationId,
  isSupportedResourceName,
} from "../src/helpers/namingUtils.js";

describe("namingUtils", () => {
  describe("isSupportedOperationId", () => {
    test("accepts camelCase and PascalCase identifiers", () => {
      expect(isSupportedOperationId("getUser")).toBe(true);
      expect(isSupportedOperationId("GetUser")).toBe(true);
      expect(isSupportedOperationId("v2UserLookup")).toBe(true);
    });

    test("rejects snake_case, kebab-case, and empty names", () => {
      expect(isSupportedOperationId("get_user")).toBe(false);
      expect(isSupportedOperationId("get-user")).toBe(false);
      expect(isSupportedOperationId("get_user-item")).toBe(false);
      expect(isSupportedOperationId("")).toBe(false);
    });
  });

  describe("isSupportedResourceName", () => {
    test("accepts camelCase and PascalCase identifiers", () => {
      expect(isSupportedResourceName("user")).toBe(true);
      expect(isSupportedResourceName("users")).toBe(true);
      expect(isSupportedResourceName("User")).toBe(true);
    });

    test("rejects snake_case, kebab-case, and empty names", () => {
      expect(isSupportedResourceName("user_profile")).toBe(false);
      expect(isSupportedResourceName("user-profile")).toBe(false);
      expect(isSupportedResourceName("")).toBe(false);
    });
  });
});
