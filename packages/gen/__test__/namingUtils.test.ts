import { describe, expect, test } from "vitest";
import {
  isSupportedOperationId,
  isSupportedResourceName,
} from "../src/helpers/namingUtils.js";

describe("namingUtils", () => {
  describe("isSupportedOperationId", () => {
    test.each([
      { scenario: "camelCase operation id", value: "getUser" },
      { scenario: "PascalCase operation id", value: "GetUser" },
      { scenario: "numeric segment in operation id", value: "v2UserLookup" },
    ])("accepts $scenario", ({ value }) => {
      expect(isSupportedOperationId(value)).toBe(true);
    });

    test.each([
      { scenario: "snake_case operation id", value: "get_user" },
      { scenario: "kebab-case operation id", value: "get-user" },
      { scenario: "mixed separator operation id", value: "get_user-item" },
      { scenario: "whitespace-only operation id", value: " " },
      { scenario: "leading whitespace operation id", value: " getUser" },
      { scenario: "trailing whitespace operation id", value: "getUser " },
      { scenario: "internal whitespace operation id", value: "get User" },
      { scenario: "punctuated operation id", value: "get.User" },
      { scenario: "leading digit operation id", value: "2User" },
    ])("rejects $scenario", ({ value }) => {
      expect(isSupportedOperationId(value)).toBe(false);
    });

    test("rejects an empty operation id", () => {
      expect(isSupportedOperationId("")).toBe(false);
    });
  });

  describe("isSupportedResourceName", () => {
    test.each([
      { scenario: "singular camelCase resource name", value: "user" },
      { scenario: "plural camelCase resource name", value: "users" },
      { scenario: "PascalCase resource name", value: "User" },
    ])("accepts $scenario", ({ value }) => {
      expect(isSupportedResourceName(value)).toBe(true);
    });

    test.each([
      { scenario: "snake_case resource name", value: "user_profile" },
      { scenario: "kebab-case resource name", value: "user-profile" },
      { scenario: "whitespace-only resource name", value: " " },
      { scenario: "leading whitespace resource name", value: " user" },
      { scenario: "trailing whitespace resource name", value: "user " },
      { scenario: "internal whitespace resource name", value: "user profile" },
      { scenario: "punctuated resource name", value: "user.profile" },
      { scenario: "leading digit resource name", value: "2User" },
    ])("rejects $scenario", ({ value }) => {
      expect(isSupportedResourceName(value)).toBe(false);
    });

    test("rejects an empty resource name", () => {
      expect(isSupportedResourceName("")).toBe(false);
    });
  });

  test.each([
    { scenario: "camelCase name", value: "getUser" },
    { scenario: "PascalCase name", value: "GetUser" },
    { scenario: "snake_case name", value: "get_user" },
    { scenario: "leading digit name", value: "2User" },
  ])(
    "keeps operation and resource support aligned for $scenario",
    ({ value }) => {
      expect(isSupportedOperationId(value)).toBe(
        isSupportedResourceName(value)
      );
    }
  );
});
