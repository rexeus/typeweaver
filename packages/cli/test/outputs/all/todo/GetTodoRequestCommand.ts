import definition from "../../../definition/todo/GetTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { GetTodoResponseValidator } from "./GetTodoResponseValidator";
import type {
  IGetTodoRequest,
  IGetTodoRequestHeader,
  IGetTodoRequestParam,
  SuccessfulGetTodoResponse,
} from "./GetTodoRequest";

import { GetTodoSuccessResponse } from "./GetTodoResponse";

export class GetTodoRequestCommand
  extends RequestCommand
  implements IGetTodoRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IGetTodoRequestHeader;
  public override readonly param: IGetTodoRequestParam;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: GetTodoResponseValidator;

  public constructor(input: Omit<IGetTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.responseValidator = new GetTodoResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulGetTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof GetTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
