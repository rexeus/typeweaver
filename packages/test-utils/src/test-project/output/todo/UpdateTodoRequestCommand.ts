import definition from "../../definition/todo/mutations/UpdateTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { UpdateTodoResponseValidator } from "./UpdateTodoResponseValidator";
import type {
  IUpdateTodoRequest,
  IUpdateTodoRequestHeader,
  IUpdateTodoRequestParam,
  IUpdateTodoRequestBody,
  SuccessfulUpdateTodoResponse,
} from "./UpdateTodoRequest";

import { UpdateTodoSuccessResponse } from "./UpdateTodoResponse";

export class UpdateTodoRequestCommand
  extends RequestCommand
  implements IUpdateTodoRequest
{
  public override readonly method = definition.method as HttpMethod.PATCH;
  public override readonly path = definition.path;

  public override readonly header: IUpdateTodoRequestHeader;
  public override readonly param: IUpdateTodoRequestParam;
  declare public readonly query: undefined;
  public override readonly body: IUpdateTodoRequestBody;

  private readonly responseValidator: UpdateTodoResponseValidator;

  public constructor(input: Omit<IUpdateTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.body = input.body;

    this.responseValidator = new UpdateTodoResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulUpdateTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof UpdateTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
