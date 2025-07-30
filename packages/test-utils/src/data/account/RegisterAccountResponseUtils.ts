import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  IRegisterAccountSuccessResponseBody,
  IRegisterAccountSuccessResponseHeader,
  IRegisterAccountSuccessResponse,
} from "../..";
import { RegisterAccountSuccessResponse } from "../..";

export const createRegisterAccountSuccessResponseHeaders =
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
): RegisterAccountSuccessResponse {
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
      header: createRegisterAccountSuccessResponseHeaders,
    },
    input
  );
  return new RegisterAccountSuccessResponse(responseData);
}
