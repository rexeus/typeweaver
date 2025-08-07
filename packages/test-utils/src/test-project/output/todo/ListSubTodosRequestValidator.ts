import definition from "../../definition/todo/queries/ListSubTodosDefinition";
import {
  type IHttpRequest,
  type SafeRequestValidationResult,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import { RequestValidator } from "../lib/types";
import type { IListSubTodosRequest } from "./ListSubTodosRequest";

export class ListSubTodosRequestValidator extends RequestValidator {
  public safeValidate(
    request: IHttpRequest,
  ): SafeRequestValidationResult<IListSubTodosRequest> {
    const error = new RequestValidationError();
    const validatedRequest: IHttpRequest = {
      method: request.method,
      path: request.path,
      query: undefined,
      header: undefined,
      body: undefined,
      param: undefined,
    };

    if (definition.request.header) {
      const coercedHeader = this.coerceHeaderToSchema(
        request.header,
        definition.request.header.shape,
      );
      const result = definition.request.header.safeParse(coercedHeader);

      if (!result.success) {
        error.addHeaderIssues(result.error.issues);
      } else {
        validatedRequest.header = result.data;
      }
    }

    if (definition.request.param) {
      const result = definition.request.param.safeParse(request.param);

      if (!result.success) {
        error.addPathParamIssues(result.error.issues);
      } else {
        validatedRequest.param = result.data;
      }
    }

    if (definition.request.query) {
      const coercedQuery = this.coerceQueryToSchema(
        request.query,
        definition.request.query.shape,
      );
      const result = definition.request.query.safeParse(coercedQuery);

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
      data: validatedRequest as IListSubTodosRequest,
    };
  }

  public validate(request: IHttpRequest): IListSubTodosRequest {
    const result = this.safeValidate(request);

    if (!result.isValid) {
      throw result.error;
    }

    return result.data;
  }
}
