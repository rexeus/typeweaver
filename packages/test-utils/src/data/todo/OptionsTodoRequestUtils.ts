import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IOptionsTodoRequest,
  IOptionsTodoRequestHeader,
  IOptionsTodoRequestParam,
} from "../..";

export const createOptionsTodoRequestHeader =
  createDataFactory<IOptionsTodoRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": ["Content-Type", "Authorization"],
  }));

export const createOptionsTodoRequestParam =
  createDataFactory<IOptionsTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

type CreateOptionsTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IOptionsTodoRequestHeader>;
  param?: Partial<IOptionsTodoRequestParam>;
};

export function createOptionsTodoRequest(
  input: CreateOptionsTodoRequestInput = {}
): IOptionsTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createOptionsTodoRequestParam(input.param)
    : createOptionsTodoRequestParam();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}`;

  return createRequest<
    IOptionsTodoRequest,
    never,
    IOptionsTodoRequestHeader,
    IOptionsTodoRequestParam,
    never
  >(
    {
      method: HttpMethod.OPTIONS,
      path: dynamicPath,
    },
    {
      header: createOptionsTodoRequestHeader,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
