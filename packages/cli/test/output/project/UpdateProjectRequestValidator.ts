import definition from "../../definition/project/UpdateProjectDefinition";
import { type IHttpRequest } from "@rexeus/typeweaver-core";
import {
  type SafeRequestValidationResult,
  RequestValidator,
  RequestValidationError,
} from "../lib/types";
import type { IUpdateProjectRequest } from "./UpdateProjectRequest";

export class UpdateProjectRequestValidator extends RequestValidator {
  public safeValidate(
    request: IHttpRequest,
  ): SafeRequestValidationResult<IUpdateProjectRequest> {
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
      data: validatedRequest as IUpdateProjectRequest,
    };
  }

  public validate(request: IHttpRequest): IUpdateProjectRequest {
    const result = this.safeValidate(request);

    if (!result.isValid) {
      throw result.error;
    }

    return result.data;
  }
}
