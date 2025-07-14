import definition from "../../../definition/todo/CreateTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { CreateTodoResponseValidator } from "./CreateTodoResponseValidator";
import type {
  ICreateTodoRequest,
  ICreateTodoRequestHeader,
  ICreateTodoRequestBody,
  SuccessfulCreateTodoResponse,
} from "./CreateTodoRequest";

import { CreateTodoSuccessResponse } from "./CreateTodoResponse";

export class CreateTodoRequestCommand
  extends RequestCommand
  implements ICreateTodoRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: ICreateTodoRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  public override readonly body: ICreateTodoRequestBody;

  private readonly responseValidator: CreateTodoResponseValidator;

  public constructor(input: Omit<ICreateTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.body = input.body;

    this.responseValidator = new CreateTodoResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulCreateTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof CreateTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
