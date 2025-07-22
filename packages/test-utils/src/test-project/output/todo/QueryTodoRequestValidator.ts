import definition from "../../definition/todo/queries/QueryTodoDefinition";
import {
  type IHttpRequest,
  type SafeRequestValidationResult,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import { RequestValidator } from "../lib/types";
import type { IQueryTodoRequest } from "./QueryTodoRequest";

export class QueryTodoRequestValidator extends RequestValidator {
  public safeValidate(
    request: IHttpRequest,
  ): SafeRequestValidationResult<IQueryTodoRequest> {
    const error = new RequestValidationError();
    const validatedRequest: IHttpRequest = {
      method: request.method,
      path: request.path,
      query: undefined,
      header: undefined,
      body: undefined,
      param: undefined,
    };

    if (definition.request.body) {
      const result = definition.request.body.safeParse(request.body);

      if (!result.success) {
        error.addBodyIssues(result.error.issues);
      } else {
        validatedRequest.body = result.data;
      }
    }

    if (definition.request.header) {
      const result = definition.request.header.safeParse(request.header);

      if (!result.success) {
        error.addHeaderIssues(result.error.issues);
      } else {
        validatedRequest.header = result.data;
      }
    }

    if (definition.request.query) {
      const result = definition.request.query.safeParse(request.query);

      if (!result.success) {
        error.addQueryIssues(result.error.issues);
      } else {
        validatedRequest.query = result.data;
      }
    }

    if (error.hasIssues()) {
      return {
        isValid: false,
        error,
      };
    }

    return {
      isValid: true,
      data: validatedRequest as IQueryTodoRequest,
    };
  }

  public validate(request: IHttpRequest): IQueryTodoRequest {
    const result = this.safeValidate(request);

    if (!result.isValid) {
      throw result.error;
    }

    return result.data;
  }
}
