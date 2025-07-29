import definition from "../../definition/todo/queries/HeadTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { HeadTodoResponseValidator } from "./HeadTodoResponseValidator";
import type {
  IHeadTodoRequest,
  IHeadTodoRequestHeader,
  IHeadTodoRequestParam,
  SuccessfulHeadTodoResponse,
} from "./HeadTodoRequest";

import { HeadTodoSuccessResponse } from "./HeadTodoResponse";

export class HeadTodoRequestCommand
  extends RequestCommand
  implements IHeadTodoRequest
{
  public override readonly method = definition.method as HttpMethod.HEAD;
  public override readonly path = definition.path;

  public override readonly header: IHeadTodoRequestHeader;
  public override readonly param: IHeadTodoRequestParam;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: HeadTodoResponseValidator;

  public constructor(input: Omit<IHeadTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.responseValidator = new HeadTodoResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulHeadTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof HeadTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
