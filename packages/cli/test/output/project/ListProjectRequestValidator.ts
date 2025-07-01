import definition from "../../definition/project/ListProjectDefinition";
import { type IHttpRequest } from "@rexeus/typeweaver-core";
import {
  type SafeRequestValidationResult,
  RequestValidator,
  RequestValidationError,
} from "../lib/types";
import type { IListProjectRequest } from "./ListProjectRequest";

export class ListProjectRequestValidator extends RequestValidator {
  public safeValidate(
    request: IHttpRequest,
  ): SafeRequestValidationResult<IListProjectRequest> {
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

    if (error.hasIssues()) {
      return {
        isValid: false,
        error,
      };
    }

    return {
      isValid: true,
      data: validatedRequest as IListProjectRequest,
    };
  }

  public validate(request: IHttpRequest): IListProjectRequest {
    const result = this.safeValidate(request);

    if (!result.isValid) {
      throw result.error;
    }

    return result.data;
  }
}
