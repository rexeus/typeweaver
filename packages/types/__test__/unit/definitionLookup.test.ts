import type {
  ResponseDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  getOperationDefinition,
  getResponseDefinition,
} from "../../src/lib/definitionLookup.js";

describe("definitionLookup", () => {
  test("returns the matching operation definition", () => {
    const spec = {
      resources: {
        account: {
          operations: [
            {
              operationId: "registerAccount",
              method: "POST",
              path: "/accounts",
              summary: "Register account",
              responses: [],
            },
          ],
        },
      },
      responses: [],
    } as unknown as SpecDefinition;

    const operation = getOperationDefinition(
      spec,
      "account",
      "registerAccount"
    );

    expect(operation.operationId).toBe("registerAccount");
  });

  test("throws when the operation definition is missing", () => {
    const spec = {
      resources: {
        account: {
          operations: [],
        },
      },
      responses: [],
    } as SpecDefinition;

    expect(() =>
      getOperationDefinition(spec, "account", "registerAccount")
    ).toThrowError("Missing operation definition 'account.registerAccount'.");
  });

  test("returns the matching response definition", () => {
    const responses = [
      {
        name: "RegisterAccountSuccess",
        kind: "response",
        statusCode: 201,
        statusCodeName: "CREATED",
        description: "Created",
      },
    ] as unknown as readonly ResponseDefinition[];

    const response = getResponseDefinition(responses, "RegisterAccountSuccess");

    expect(response.name).toBe("RegisterAccountSuccess");
  });

  test("throws when the response definition is missing", () => {
    const responses = [] as readonly ResponseDefinition[];

    expect(() =>
      getResponseDefinition(responses, "RegisterAccountSuccess")
    ).toThrowError("Missing response definition 'RegisterAccountSuccess'.");
  });
});
