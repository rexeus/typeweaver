import definition from "../../definition/auth/LogoutDefinition";
import {
  type IHttpRequest,
  type SafeRequestValidationResult,
  RequestValidator,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import type { ILogoutRequest } from "./LogoutRequest";

export class LogoutRequestValidator extends RequestValidator {
  public safeValidate(
    request: IHttpRequest,
  ): SafeRequestValidationResult<ILogoutRequest> {
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

    if (error.hasIssues()) {
      return {
        isValid: false,
        error,
      };
    }

    return {
      isValid: true,
      data: validatedRequest as ILogoutRequest,
    };
  }

  public validate(request: IHttpRequest): ILogoutRequest {
    const result = this.safeValidate(request);

    if (!result.isValid) {
      throw result.error;
    }

    return result.data;
  }
}
