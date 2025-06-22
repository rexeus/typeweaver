import definition from "../../definition/project/CreateProjectDefinition";
import {
  type IHttpRequest,
  type SafeRequestValidationResult,
  RequestValidator,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import type { ICreateProjectRequest } from "./CreateProjectRequest";

export class CreateProjectRequestValidator extends RequestValidator {
  public safeValidate(
    request: IHttpRequest,
  ): SafeRequestValidationResult<ICreateProjectRequest> {
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
      data: validatedRequest as ICreateProjectRequest,
    };
  }

  public validate(request: IHttpRequest): ICreateProjectRequest {
    const result = this.safeValidate(request);

    if (!result.isValid) {
      throw result.error;
    }

    return result.data;
  }
}
