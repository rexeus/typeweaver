import definition from "../../definition/ad/GetAdDefinition";
import { type IHttpRequest } from "@rexeus/typeweaver-core";
import {
  type SafeRequestValidationResult,
  RequestValidator,
  RequestValidationError,
} from "../lib/types";
import type { IGetAdRequest } from "./GetAdRequest";

export class GetAdRequestValidator extends RequestValidator {
  public safeValidate(
    request: IHttpRequest,
  ): SafeRequestValidationResult<IGetAdRequest> {
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

    if (definition.request.param) {
      const result = definition.request.param.safeParse(request.param);

      if (!result.success) {
        error.addPathParamIssues(result.error.issues);
      } else {
        validatedRequest.param = result.data;
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
      data: validatedRequest as IGetAdRequest,
    };
  }

  public validate(request: IHttpRequest): IGetAdRequest {
    const result = this.safeValidate(request);

    if (!result.isValid) {
      throw result.error;
    }

    return result.data;
  }
}
