import definition from "../../definition/todo/mutations/DeleteSubTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { DeleteSubTodoResponseValidator } from "./DeleteSubTodoResponseValidator";
import type {
  IDeleteSubTodoRequest,
  IDeleteSubTodoRequestHeader,
  IDeleteSubTodoRequestParam,
  SuccessfulDeleteSubTodoResponse,
} from "./DeleteSubTodoRequest";

import { DeleteSubTodoSuccessResponse } from "./DeleteSubTodoResponse";

export class DeleteSubTodoRequestCommand
  extends RequestCommand
  implements IDeleteSubTodoRequest
{
  public override readonly method = definition.method as HttpMethod.DELETE;
  public override readonly path = definition.path;

  public override readonly header: IDeleteSubTodoRequestHeader;
  public override readonly param: IDeleteSubTodoRequestParam;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: DeleteSubTodoResponseValidator;

  public constructor(input: Omit<IDeleteSubTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.responseValidator = new DeleteSubTodoResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulDeleteSubTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof DeleteSubTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
