import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createRegisterAccountSuccessResponse as generatedCreateRegisterAccountSuccessResponse } from "../../test-project/output/responses/RegisterAccountSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createResponse } from "../createResponse.js";
import type {
  IRegisterAccountSuccessResponse,
  IRegisterAccountSuccessResponseBody,
  IRegisterAccountSuccessResponseHeader,
} from "../../index.js";

export const createRegisterAccountSuccessResponseHeader =
  createDataFactory<IRegisterAccountSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createRegisterAccountSuccessResponseBody =
  createDataFactory<IRegisterAccountSuccessResponseBody>(() => ({
    id: faker.string.ulid(),
    email: faker.internet.email(),
    createdAt: faker.date.past().toISOString(),
    modifiedAt: faker.date.recent().toISOString(),
    createdBy: faker.internet.username(),
    modifiedBy: faker.internet.username(),
  }));

type RegisterAccountSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IRegisterAccountSuccessResponseHeader>;
  body?: Partial<IRegisterAccountSuccessResponseBody>;
};

export function createRegisterAccountSuccessResponse(
  input: RegisterAccountSuccessResponseInput = {}
): IRegisterAccountSuccessResponse {
  const responseData = createResponse<
    IRegisterAccountSuccessResponse,
    IRegisterAccountSuccessResponseBody,
    IRegisterAccountSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CREATED,
    },
    {
      body: createRegisterAccountSuccessResponseBody,
      header: createRegisterAccountSuccessResponseHeader,
    },
    input
  );
  return generatedCreateRegisterAccountSuccessResponse(responseData);
}
