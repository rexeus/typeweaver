import { describe, expect, test } from "vitest";
import {
  validateRequest,
  validateResponse,
} from "../examples/documentation/types-surface.js";

describe("documentation examples", () => {
  test("validates the documented request", () => {
    expect(validateRequest()).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });

  test("validates and parses the documented response", () => {
    const result = validateResponse();

    expect(result.isValid).toBe(true);
    if (!result.isValid) return;

    expect(result.data.type).toBe("GetTodoSuccess");
    expect(result.data.body).not.toHaveProperty("internalOnly");
  });
});
