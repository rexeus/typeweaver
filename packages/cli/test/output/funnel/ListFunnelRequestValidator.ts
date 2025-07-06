import definition from "../../definition/funnel/ListFunnelDefinition";
import {
  type IHttpRequest,
  type SafeRequestValidationResult,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import { RequestValidator } from "../lib/types";
import type { IListFunnelRequest } from "./ListFunnelRequest";

export class ListFunnelRequestValidator extends RequestValidator {
  public safeValidate(
    request: IHttpRequest,
  ): SafeRequestValidationResult<IListFunnelRequest> {
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
      data: validatedRequest as IListFunnelRequest,
    };
  }

  public validate(request: IHttpRequest): IListFunnelRequest {
    const result = this.safeValidate(request);

    if (!result.isValid) {
      throw result.error;
    }

    return result.data;
  }
}
