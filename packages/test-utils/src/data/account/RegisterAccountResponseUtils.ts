import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import type {
  IRegisterAccountSuccessResponseBody,
  IRegisterAccountSuccessResponseHeader,
  IRegisterAccountSuccessResponse,
} from "../..";

export function createRegisterAccountSuccessResponseHeaders(
  input: Partial<IRegisterAccountSuccessResponseHeader> = {}
): IRegisterAccountSuccessResponseHeader {
  const defaults: IRegisterAccountSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createRegisterAccountSuccessResponseBody(
  input: Partial<IRegisterAccountSuccessResponseBody> = {}
): IRegisterAccountSuccessResponseBody {
  const defaults: IRegisterAccountSuccessResponseBody = {
    id: faker.string.ulid(),
    email: faker.internet.email(),
    createdAt: faker.date.past().toISOString(),
    modifiedAt: faker.date.recent().toISOString(),
    createdBy: faker.internet.username(),
    modifiedBy: faker.internet.username(),
  };

  return createData(defaults, input);
}

type RegisterAccountSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IRegisterAccountSuccessResponseHeader>;
  body?: Partial<IRegisterAccountSuccessResponseBody>;
};

export function createRegisterAccountSuccessResponse(
  input: RegisterAccountSuccessResponseInput = {}
): IRegisterAccountSuccessResponse {
  const defaults: IRegisterAccountSuccessResponse = {
    statusCode: HttpStatusCode.CREATED,
    header: createRegisterAccountSuccessResponseHeaders(),
    body: createRegisterAccountSuccessResponseBody(),
  };

  const overrides: Partial<IRegisterAccountSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createRegisterAccountSuccessResponseHeaders(
      input.header
    );
  if (input.body !== undefined)
    overrides.body = createRegisterAccountSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}
