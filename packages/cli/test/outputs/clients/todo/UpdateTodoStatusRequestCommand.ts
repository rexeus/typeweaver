import definition from "../../../definition/todo/UpdateTodoStatusDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { UpdateTodoStatusResponseValidator } from "./UpdateTodoStatusResponseValidator";
import type {
  IUpdateTodoStatusRequest,
  IUpdateTodoStatusRequestHeader,
  IUpdateTodoStatusRequestParam,
  IUpdateTodoStatusRequestBody,
  SuccessfulUpdateTodoStatusResponse,
} from "./UpdateTodoStatusRequest";

import { UpdateTodoStatusSuccessResponse } from "./UpdateTodoStatusResponse";

export class UpdateTodoStatusRequestCommand
  extends RequestCommand
  implements IUpdateTodoStatusRequest
{
  public override readonly method = definition.method as HttpMethod.PUT;
  public override readonly path = definition.path;

  public override readonly header: IUpdateTodoStatusRequestHeader;
  public override readonly param: IUpdateTodoStatusRequestParam;
  declare public readonly query: undefined;
  public override readonly body: IUpdateTodoStatusRequestBody;

  private readonly responseValidator: UpdateTodoStatusResponseValidator;

  public constructor(input: Omit<IUpdateTodoStatusRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.body = input.body;

    this.responseValidator = new UpdateTodoStatusResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulUpdateTodoStatusResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof UpdateTodoStatusSuccessResponse) {
      return result;
    }

    throw result;
  }
}
