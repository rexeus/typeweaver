import { describe, expect, test } from "vitest";
import {
  hasHeaderName,
  readSingletonHeader,
} from "../../../src/lib/middleware/header.js";

describe("readSingletonHeader with explicit undefined values", () => {
  test("returns undefined for a lone undefined entry", () => {
    expect(
      readSingletonHeader({ origin: undefined }, "origin")
    ).toBeUndefined();
  });

  test("reads undefined-valued entry names case-insensitively", () => {
    expect(
      readSingletonHeader({ Origin: undefined }, "origin")
    ).toBeUndefined();
  });

  test.each([
    {
      case: "valid entry first",
      header: { origin: "https://app.com", Origin: undefined },
    },
    {
      case: "undefined entry first",
      header: { Origin: undefined, origin: "https://app.com" },
    },
  ])(
    "returns the valid singleton when an undefined entry shares the name ($case)",
    ({ header }) => {
      expect(readSingletonHeader(header, "origin")).toBe("https://app.com");
    }
  );

  test("preserves duplicate detection for genuine differently cased values", () => {
    expect(
      readSingletonHeader(
        { origin: "https://app.com", Origin: "https://evil.com" },
        "origin"
      )
    ).toBeUndefined();
  });

  test("preserves duplicate detection for repeated array values alongside undefined", () => {
    expect(
      readSingletonHeader(
        {
          origin: ["https://app.com", "https://evil.com"],
          Origin: undefined,
        },
        "origin"
      )
    ).toBeUndefined();
  });
});

describe("hasHeaderName with explicit undefined values", () => {
  test("reports a lone undefined entry as absent", () => {
    expect(hasHeaderName({ origin: undefined }, "origin")).toBe(false);
  });

  test("reports presence when a valid entry shares the name with undefined", () => {
    expect(
      hasHeaderName({ origin: "https://app.com", Origin: undefined }, "origin")
    ).toBe(true);
  });

  test("reports presence for genuine duplicates", () => {
    expect(
      hasHeaderName(
        { origin: "https://app.com", Origin: "https://evil.com" },
        "origin"
      )
    ).toBe(true);
  });
});
