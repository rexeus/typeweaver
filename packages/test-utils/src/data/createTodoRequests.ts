import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { createData } from "./createData";
import { createTodoInput } from "./createTodo";
import { createTodoRequestHeaders } from "./createTodoHeaders";
import type {
  ICreateTodoRequestBody,
  ICreateTodoRequestHeader,
} from "..";

type CreateTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  body?: Partial<ICreateTodoRequestBody>;
  header?: Partial<ICreateTodoRequestHeader>;
};

export function createTodoRequest(
  input: CreateTodoRequestInput = {}
): IHttpRequest {
  const defaults: IHttpRequest = {
    method: HttpMethod.POST,
    path: "/todos",
    body: createTodoInput(),
    header: createTodoRequestHeaders(),
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;
  if (input.body !== undefined) overrides.body = createTodoInput(input.body);
  if (input.header !== undefined) overrides.header = createTodoRequestHeaders(input.header);

  return createData(defaults, overrides);
}