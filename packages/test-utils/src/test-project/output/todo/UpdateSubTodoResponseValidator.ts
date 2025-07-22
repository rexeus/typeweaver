import definition from "../../definition/todo/mutations/UpdateSubTodoDefinition";
import {
  type IHttpResponse,
  type SafeResponseValidationResult,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import {
  ResponseValidator,
  InvalidResponseStatusCodeError,
  assert,
} from "../lib/types";
import {
  type UpdateSubTodoResponse,
  type IUpdateSubTodoSuccessResponse,
  UpdateSubTodoSuccessResponse,
} from "./UpdateSubTodoResponse";

import {
  type ISubTodoNotFoundErrorResponse,
  SubTodoNotFoundErrorResponse,
} from "./SubTodoNotFoundErrorResponse";

import {
  type ISubTodoNotChangeableErrorResponse,
  SubTodoNotChangeableErrorResponse,
} from "./SubTodoNotChangeableErrorResponse";

import {
  type ISubTodoStatusTransitionInvalidErrorResponse,
  SubTodoStatusTransitionInvalidErrorResponse,
} from "./SubTodoStatusTransitionInvalidErrorResponse";

import {
  type ITodoNotFoundErrorResponse,
  TodoNotFoundErrorResponse,
} from "./TodoNotFoundErrorResponse";

import {
  type IForbiddenErrorResponse,
  ForbiddenErrorResponse,
} from "../shared/ForbiddenErrorResponse";

import {
  type IInternalServerErrorResponse,
  InternalServerErrorResponse,
} from "../shared/InternalServerErrorResponse";

import {
  type ITooManyRequestsErrorResponse,
  TooManyRequestsErrorResponse,
} from "../shared/TooManyRequestsErrorResponse";

import {
  type IUnauthorizedErrorResponse,
  UnauthorizedErrorResponse,
} from "../shared/UnauthorizedErrorResponse";

import {
  type IUnsupportedMediaTypeErrorResponse,
  UnsupportedMediaTypeErrorResponse,
} from "../shared/UnsupportedMediaTypeErrorResponse";

import {
  type IValidationErrorResponse,
  ValidationErrorResponse,
} from "../shared/ValidationErrorResponse";

export class UpdateSubTodoResponseValidator extends ResponseValidator {
  public safeValidate(
    response: IHttpResponse,
  ): SafeResponseValidationResult<UpdateSubTodoResponse> {
    const error = new ResponseValidationError(response.statusCode);
    const validationResult = this.validateAgainstDefinedResponses(
      response,
      error,
    );

    if (error.hasIssues() && !validationResult.validResponseName) {
      return {
        isValid: false,
        error,
      };
    }

    let data: UpdateSubTodoResponse;
    switch (response.statusCode) {
      case 200: {
        if (validationResult.validResponseName === "UpdateSubTodoSuccess") {
          data = new UpdateSubTodoSuccessResponse(
            validationResult.validatedResponse as unknown as IUpdateSubTodoSuccessResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '200'");
      }

      case 404: {
        if (validationResult.validResponseName === "SubTodoNotFoundError") {
          data = new SubTodoNotFoundErrorResponse(
            validationResult.validatedResponse as unknown as ISubTodoNotFoundErrorResponse,
          );
          break;
        }

        if (validationResult.validResponseName === "TodoNotFoundError") {
          data = new TodoNotFoundErrorResponse(
            validationResult.validatedResponse as unknown as ITodoNotFoundErrorResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '404'");
      }

      case 409: {
        if (
          validationResult.validResponseName === "SubTodoNotChangeableError"
        ) {
          data = new SubTodoNotChangeableErrorResponse(
            validationResult.validatedResponse as unknown as ISubTodoNotChangeableErrorResponse,
          );
          break;
        }

        if (
          validationResult.validResponseName ===
          "SubTodoStatusTransitionInvalidError"
        ) {
          data = new SubTodoStatusTransitionInvalidErrorResponse(
            validationResult.validatedResponse as unknown as ISubTodoStatusTransitionInvalidErrorResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '409'");
      }

      case 403: {
        if (validationResult.validResponseName === "ForbiddenError") {
          data = new ForbiddenErrorResponse(
            validationResult.validatedResponse as unknown as IForbiddenErrorResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '403'");
      }

      case 500: {
        if (validationResult.validResponseName === "InternalServerError") {
          data = new InternalServerErrorResponse(
            validationResult.validatedResponse as unknown as IInternalServerErrorResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '500'");
      }

      case 429: {
        if (validationResult.validResponseName === "TooManyRequestsError") {
          data = new TooManyRequestsErrorResponse(
            validationResult.validatedResponse as unknown as ITooManyRequestsErrorResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '429'");
      }

      case 401: {
        if (validationResult.validResponseName === "UnauthorizedError") {
          data = new UnauthorizedErrorResponse(
            validationResult.validatedResponse as unknown as IUnauthorizedErrorResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '401'");
      }

      case 415: {
        if (
          validationResult.validResponseName === "UnsupportedMediaTypeError"
        ) {
          data = new UnsupportedMediaTypeErrorResponse(
            validationResult.validatedResponse as unknown as IUnsupportedMediaTypeErrorResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '415'");
      }

      case 400: {
        if (validationResult.validResponseName === "ValidationError") {
          data = new ValidationErrorResponse(
            validationResult.validatedResponse as unknown as IValidationErrorResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '400'");
      }

      default: {
        throw new InvalidResponseStatusCodeError(response);
      }
    }

    return {
      isValid: true,
      data,
    };
  }

  public validate(response: IHttpResponse): UpdateSubTodoResponse {
    const result = this.safeValidate(response);

    if (!result.isValid) {
      throw result.error;
    }

    return result.data;
  }

  private validateAgainstDefinedResponses(
    response: IHttpResponse,
    error: ResponseValidationError,
  ): { validResponseName?: string; validatedResponse?: IHttpResponse } {
    const validatedResponse: IHttpResponse = {
      statusCode: response.statusCode,
      header: undefined,
      body: undefined,
    };

    if (response.statusCode === 200) {
      const isUpdateSubTodoSuccessResponse =
        this.validateUpdateSubTodoSuccessResponse(
          response,
          validatedResponse,
          error,
        );
      if (isUpdateSubTodoSuccessResponse) {
        return { validResponseName: "UpdateSubTodoSuccess", validatedResponse };
      }
    }

    if (response.statusCode === 404) {
      const isSubTodoNotFoundErrorResponse =
        this.validateSubTodoNotFoundErrorResponse(
          response,
          validatedResponse,
          error,
        );
      if (isSubTodoNotFoundErrorResponse) {
        return { validResponseName: "SubTodoNotFoundError", validatedResponse };
      }

      const isTodoNotFoundErrorResponse =
        this.validateTodoNotFoundErrorResponse(
          response,
          validatedResponse,
          error,
        );
      if (isTodoNotFoundErrorResponse) {
        return { validResponseName: "TodoNotFoundError", validatedResponse };
      }
    }

    if (response.statusCode === 409) {
      const isSubTodoNotChangeableErrorResponse =
        this.validateSubTodoNotChangeableErrorResponse(
          response,
          validatedResponse,
          error,
        );
      if (isSubTodoNotChangeableErrorResponse) {
        return {
          validResponseName: "SubTodoNotChangeableError",
          validatedResponse,
        };
      }

      const isSubTodoStatusTransitionInvalidErrorResponse =
        this.validateSubTodoStatusTransitionInvalidErrorResponse(
          response,
          validatedResponse,
          error,
        );
      if (isSubTodoStatusTransitionInvalidErrorResponse) {
        return {
          validResponseName: "SubTodoStatusTransitionInvalidError",
          validatedResponse,
        };
      }
    }

    if (response.statusCode === 403) {
      const isForbiddenErrorResponse = this.validateForbiddenErrorResponse(
        response,
        validatedResponse,
        error,
      );
      if (isForbiddenErrorResponse) {
        return { validResponseName: "ForbiddenError", validatedResponse };
      }
    }

    if (response.statusCode === 500) {
      const isInternalServerErrorResponse =
        this.validateInternalServerErrorResponse(
          response,
          validatedResponse,
          error,
        );
      if (isInternalServerErrorResponse) {
        return { validResponseName: "InternalServerError", validatedResponse };
      }
    }

    if (response.statusCode === 429) {
      const isTooManyRequestsErrorResponse =
        this.validateTooManyRequestsErrorResponse(
          response,
          validatedResponse,
          error,
        );
      if (isTooManyRequestsErrorResponse) {
        return { validResponseName: "TooManyRequestsError", validatedResponse };
      }
    }

    if (response.statusCode === 401) {
      const isUnauthorizedErrorResponse =
        this.validateUnauthorizedErrorResponse(
          response,
          validatedResponse,
          error,
        );
      if (isUnauthorizedErrorResponse) {
        return { validResponseName: "UnauthorizedError", validatedResponse };
      }
    }

    if (response.statusCode === 415) {
      const isUnsupportedMediaTypeErrorResponse =
        this.validateUnsupportedMediaTypeErrorResponse(
          response,
          validatedResponse,
          error,
        );
      if (isUnsupportedMediaTypeErrorResponse) {
        return {
          validResponseName: "UnsupportedMediaTypeError",
          validatedResponse,
        };
      }
    }

    if (response.statusCode === 400) {
      const isValidationErrorResponse = this.validateValidationErrorResponse(
        response,
        validatedResponse,
        error,
      );
      if (isValidationErrorResponse) {
        return { validResponseName: "ValidationError", validatedResponse };
      }
    }

    return {};
  }

  private validateUpdateSubTodoSuccessResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[0] &&
        "body" in definition.responses[0] &&
        definition.responses[0].body,
      "'UpdateSubTodoSuccessResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[0].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[0] &&
        "header" in definition.responses[0] &&
        definition.responses[0].header,
      "'UpdateSubTodoSuccessResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[0].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateSubTodoNotFoundErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[1] &&
        "body" in definition.responses[1] &&
        definition.responses[1].body,
      "'SubTodoNotFoundErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[1].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[1] &&
        "header" in definition.responses[1] &&
        definition.responses[1].header,
      "'SubTodoNotFoundErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[1].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateSubTodoNotChangeableErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[2] &&
        "body" in definition.responses[2] &&
        definition.responses[2].body,
      "'SubTodoNotChangeableErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[2].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[2] &&
        "header" in definition.responses[2] &&
        definition.responses[2].header,
      "'SubTodoNotChangeableErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[2].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateSubTodoStatusTransitionInvalidErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[3] &&
        "body" in definition.responses[3] &&
        definition.responses[3].body,
      "'SubTodoStatusTransitionInvalidErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[3].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[3] &&
        "header" in definition.responses[3] &&
        definition.responses[3].header,
      "'SubTodoStatusTransitionInvalidErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[3].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateTodoNotFoundErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[4] &&
        "body" in definition.responses[4] &&
        definition.responses[4].body,
      "'TodoNotFoundErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[4].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[4] &&
        "header" in definition.responses[4] &&
        definition.responses[4].header,
      "'TodoNotFoundErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[4].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateForbiddenErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[5] &&
        "body" in definition.responses[5] &&
        definition.responses[5].body,
      "'ForbiddenErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[5].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[5] &&
        "header" in definition.responses[5] &&
        definition.responses[5].header,
      "'ForbiddenErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[5].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateInternalServerErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[6] &&
        "body" in definition.responses[6] &&
        definition.responses[6].body,
      "'InternalServerErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[6].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[6] &&
        "header" in definition.responses[6] &&
        definition.responses[6].header,
      "'InternalServerErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[6].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateTooManyRequestsErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[7] &&
        "body" in definition.responses[7] &&
        definition.responses[7].body,
      "'TooManyRequestsErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[7].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[7] &&
        "header" in definition.responses[7] &&
        definition.responses[7].header,
      "'TooManyRequestsErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[7].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateUnauthorizedErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[8] &&
        "body" in definition.responses[8] &&
        definition.responses[8].body,
      "'UnauthorizedErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[8].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[8] &&
        "header" in definition.responses[8] &&
        definition.responses[8].header,
      "'UnauthorizedErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[8].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateUnsupportedMediaTypeErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[9] &&
        "body" in definition.responses[9] &&
        definition.responses[9].body,
      "'UnsupportedMediaTypeErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[9].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[9] &&
        "header" in definition.responses[9] &&
        definition.responses[9].header,
      "'UnsupportedMediaTypeErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[9].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }

  private validateValidationErrorResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[10] &&
        "body" in definition.responses[10] &&
        definition.responses[10].body,
      "'ValidationErrorResponseBody' has to be defined in the definition",
    );
    const validateBodyResult = definition.responses[10].body.safeParse(
      response.body,
    );

    if (!validateBodyResult.success) {
      error.addBodyIssues(validateBodyResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.body = validateBodyResult.data;
    }

    assert(
      definition.responses[10] &&
        "header" in definition.responses[10] &&
        definition.responses[10].header,
      "'ValidationErrorResponseHeader' has to be defined in the definition",
    );
    const validateHeaderResult = definition.responses[10].header.safeParse(
      response.header,
    );

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }
}
