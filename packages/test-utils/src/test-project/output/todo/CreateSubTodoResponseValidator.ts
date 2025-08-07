import definition from "../../definition/todo/mutations/CreateSubTodoDefinition";
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
  type CreateSubTodoResponse,
  type ICreateSubTodoSuccessResponse,
  CreateSubTodoSuccessResponse,
} from "./CreateSubTodoResponse";

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

export class CreateSubTodoResponseValidator extends ResponseValidator {
  public safeValidate(
    response: IHttpResponse,
  ): SafeResponseValidationResult<CreateSubTodoResponse> {
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

    let data: CreateSubTodoResponse;
    switch (response.statusCode) {
      case 201: {
        if (validationResult.validResponseName === "CreateSubTodoSuccess") {
          data = new CreateSubTodoSuccessResponse(
            validationResult.validatedResponse as unknown as ICreateSubTodoSuccessResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '201'");
      }

      case 404: {
        if (validationResult.validResponseName === "TodoNotFoundError") {
          data = new TodoNotFoundErrorResponse(
            validationResult.validatedResponse as unknown as ITodoNotFoundErrorResponse,
          );
          break;
        }

        throw new Error("Could not find a response for status code '404'");
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

  public validate(response: IHttpResponse): CreateSubTodoResponse {
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

    if (response.statusCode === 201) {
      const isCreateSubTodoSuccessResponse =
        this.validateCreateSubTodoSuccessResponse(
          response,
          validatedResponse,
          error,
        );
      if (isCreateSubTodoSuccessResponse) {
        return { validResponseName: "CreateSubTodoSuccess", validatedResponse };
      }
    }

    if (response.statusCode === 404) {
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

  private validateCreateSubTodoSuccessResponse(
    response: IHttpResponse,
    validatedResponse: IHttpResponse,
    error: ResponseValidationError,
  ): boolean {
    let isValid = true;

    assert(
      definition.responses[0] &&
        "body" in definition.responses[0] &&
        definition.responses[0].body,
      "'CreateSubTodoSuccessResponseBody' has to be defined in the definition",
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
      "'CreateSubTodoSuccessResponseHeader' has to be defined in the definition",
    );
    const coercedHeader = this.coerceHeaderToSchema(
      response.header,
      definition.responses[0].header.shape,
    );
    const validateHeaderResult =
      definition.responses[0].header.safeParse(coercedHeader);

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
      definition.responses[1] &&
        "body" in definition.responses[1] &&
        definition.responses[1].body,
      "'TodoNotFoundErrorResponseBody' has to be defined in the definition",
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
      "'TodoNotFoundErrorResponseHeader' has to be defined in the definition",
    );
    const coercedHeader = this.coerceHeaderToSchema(
      response.header,
      definition.responses[1].header.shape,
    );
    const validateHeaderResult =
      definition.responses[1].header.safeParse(coercedHeader);

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
      definition.responses[2] &&
        "body" in definition.responses[2] &&
        definition.responses[2].body,
      "'ForbiddenErrorResponseBody' has to be defined in the definition",
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
      "'ForbiddenErrorResponseHeader' has to be defined in the definition",
    );
    const coercedHeader = this.coerceHeaderToSchema(
      response.header,
      definition.responses[2].header.shape,
    );
    const validateHeaderResult =
      definition.responses[2].header.safeParse(coercedHeader);

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
      definition.responses[3] &&
        "body" in definition.responses[3] &&
        definition.responses[3].body,
      "'InternalServerErrorResponseBody' has to be defined in the definition",
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
      "'InternalServerErrorResponseHeader' has to be defined in the definition",
    );
    const coercedHeader = this.coerceHeaderToSchema(
      response.header,
      definition.responses[3].header.shape,
    );
    const validateHeaderResult =
      definition.responses[3].header.safeParse(coercedHeader);

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
      definition.responses[4] &&
        "body" in definition.responses[4] &&
        definition.responses[4].body,
      "'TooManyRequestsErrorResponseBody' has to be defined in the definition",
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
      "'TooManyRequestsErrorResponseHeader' has to be defined in the definition",
    );
    const coercedHeader = this.coerceHeaderToSchema(
      response.header,
      definition.responses[4].header.shape,
    );
    const validateHeaderResult =
      definition.responses[4].header.safeParse(coercedHeader);

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
      definition.responses[5] &&
        "body" in definition.responses[5] &&
        definition.responses[5].body,
      "'UnauthorizedErrorResponseBody' has to be defined in the definition",
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
      "'UnauthorizedErrorResponseHeader' has to be defined in the definition",
    );
    const coercedHeader = this.coerceHeaderToSchema(
      response.header,
      definition.responses[5].header.shape,
    );
    const validateHeaderResult =
      definition.responses[5].header.safeParse(coercedHeader);

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
      definition.responses[6] &&
        "body" in definition.responses[6] &&
        definition.responses[6].body,
      "'UnsupportedMediaTypeErrorResponseBody' has to be defined in the definition",
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
      "'UnsupportedMediaTypeErrorResponseHeader' has to be defined in the definition",
    );
    const coercedHeader = this.coerceHeaderToSchema(
      response.header,
      definition.responses[6].header.shape,
    );
    const validateHeaderResult =
      definition.responses[6].header.safeParse(coercedHeader);

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
      definition.responses[7] &&
        "body" in definition.responses[7] &&
        definition.responses[7].body,
      "'ValidationErrorResponseBody' has to be defined in the definition",
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
      "'ValidationErrorResponseHeader' has to be defined in the definition",
    );
    const coercedHeader = this.coerceHeaderToSchema(
      response.header,
      definition.responses[7].header.shape,
    );
    const validateHeaderResult =
      definition.responses[7].header.safeParse(coercedHeader);

    if (!validateHeaderResult.success) {
      error.addHeaderIssues(validateHeaderResult.error.issues);
      isValid = false;
    } else {
      validatedResponse.header = validateHeaderResult.data;
    }

    return isValid;
  }
}
