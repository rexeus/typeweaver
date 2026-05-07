import { describe, expect, test } from "vitest";
import { defineOperation } from '../../src/defineOperation.js';
import type { OperationDefinition } from '../../src/defineOperation.js';
import { defineResponse } from '../../src/defineResponse.js';
import type { ResponseDefinition } from '../../src/defineResponse.js';
import { DuplicateResponseNameError } from "../../src/DuplicateResponseNameError.js";
import { HttpMethod } from "../../src/HttpMethod.js";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";
import { validateUniqueResponseNames } from "../../src/validateResponseUniqueness.js";
import type { ResourceDefinition } from "../../src/defineSpec.js";

const aResponseNamed = (
  name: string,
  overrides: Partial<
    Pick<ResponseDefinition, "description" | "statusCode">
  > = {}
): ResponseDefinition => {
  return defineResponse({
    name,
    statusCode: HttpStatusCode.OK,
    description: `${name} response`,
    ...overrides,
  });
};

const anOperationReturning = (
  operationId: string,
  ...responses: readonly ResponseDefinition[]
): OperationDefinition => {
  return defineOperation({
    operationId,
    path: `/${operationId}`,
    method: HttpMethod.GET,
    summary: `${operationId} operation`,
    request: {},
    responses,
  });
};

const aResourceWithOperations = (
  ...operations: readonly OperationDefinition[]
): ResourceDefinition => {
  return { operations };
};

describe("validateUniqueResponseNames", () => {
  test("accepts an empty resource map", () => {
    expect(() => validateUniqueResponseNames({})).not.toThrow();
  });

  test("accepts a resource with zero operations", () => {
    const resources = {
      users: aResourceWithOperations(),
    };

    expect(() => validateUniqueResponseNames(resources)).not.toThrow();
  });

  test("accepts resources and operations without responses", () => {
    const resources = {
      users: aResourceWithOperations(anOperationReturning("getUser")),
      sessions: aResourceWithOperations(anOperationReturning("createSession")),
    };

    expect(() => validateUniqueResponseNames(resources)).not.toThrow();
  });

  test("accepts globally unique named responses", () => {
    const resources = {
      users: aResourceWithOperations(
        anOperationReturning("getUser", aResponseNamed("GetUserSuccess"))
      ),
      sessions: aResourceWithOperations(
        anOperationReturning(
          "createSession",
          aResponseNamed("CreateSessionSuccess", {
            statusCode: HttpStatusCode.CREATED,
          })
        )
      ),
    };

    expect(() => validateUniqueResponseNames(resources)).not.toThrow();
  });

  test("rejects duplicate response names within one operation", () => {
    const resources = {
      users: aResourceWithOperations(
        anOperationReturning(
          "getUser",
          aResponseNamed("SharedError", {
            statusCode: HttpStatusCode.BAD_REQUEST,
          }),
          aResponseNamed("SharedError", {
            statusCode: HttpStatusCode.UNAUTHORIZED,
          })
        )
      ),
    };

    expect(() => validateUniqueResponseNames(resources)).toThrowError(
      DuplicateResponseNameError
    );
  });

  test("rejects duplicate response names across operations in one resource", () => {
    const resources = {
      users: aResourceWithOperations(
        anOperationReturning(
          "getUser",
          aResponseNamed("SharedError", {
            statusCode: HttpStatusCode.BAD_REQUEST,
          })
        ),
        anOperationReturning(
          "updateUser",
          aResponseNamed("SharedError", {
            statusCode: HttpStatusCode.UNAUTHORIZED,
          })
        )
      ),
    };

    expect(() => validateUniqueResponseNames(resources)).toThrowError(
      DuplicateResponseNameError
    );
  });

  test("rejects duplicate response names across resources", () => {
    const resources = {
      users: aResourceWithOperations(
        anOperationReturning(
          "getUser",
          aResponseNamed("SharedError", {
            statusCode: HttpStatusCode.BAD_REQUEST,
          })
        )
      ),
      sessions: aResourceWithOperations(
        anOperationReturning(
          "createSession",
          aResponseNamed("SharedError", {
            statusCode: HttpStatusCode.UNAUTHORIZED,
          })
        )
      ),
    };

    expect(() => validateUniqueResponseNames(resources)).toThrowError(
      DuplicateResponseNameError
    );
  });

  test("rejects distinct but structurally identical response objects with the same name", () => {
    const resources = {
      users: aResourceWithOperations(
        anOperationReturning("getUser", aResponseNamed("SharedError"))
      ),
      sessions: aResourceWithOperations(
        anOperationReturning("createSession", aResponseNamed("SharedError"))
      ),
    };

    expect(() => validateUniqueResponseNames(resources)).toThrowError(
      DuplicateResponseNameError
    );
  });

  test("reports the duplicate response name in the error message", () => {
    const resources = {
      users: aResourceWithOperations(
        anOperationReturning("getUser", aResponseNamed("SharedError"))
      ),
      sessions: aResourceWithOperations(
        anOperationReturning("createSession", aResponseNamed("SharedError"))
      ),
    };

    expect(() => validateUniqueResponseNames(resources)).toThrowError(
      "SharedError"
    );
  });

  test("allows reusing the same response definition instance", () => {
    const sharedResponse = aResponseNamed("SharedError", {
      statusCode: HttpStatusCode.BAD_REQUEST,
    });
    const resources = {
      users: aResourceWithOperations(
        anOperationReturning("getUser", sharedResponse)
      ),
      sessions: aResourceWithOperations(
        anOperationReturning("createSession", sharedResponse)
      ),
    };

    expect(() => validateUniqueResponseNames(resources)).not.toThrow();
  });
});
