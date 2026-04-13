import { ForbiddenErrorDefinition } from "./ForbiddenErrorDefinition.js";
import { InternalServerErrorDefinition } from "./InternalServerErrorDefinition.js";
import { TooManyRequestsErrorDefinition } from "./TooManyRequestsErrorDefinition.js";
import { UnauthorizedErrorDefinition } from "./UnauthorizedErrorDefinition.js";
import { UnsupportedMediaTypeErrorDefinition } from "./UnsupportedMediaTypeErrorDefinition.js";
import { ValidationErrorDefinition } from "./ValidationErrorDefinition.js";

export const sharedResponses = [
  ForbiddenErrorDefinition,
  InternalServerErrorDefinition,
  TooManyRequestsErrorDefinition,
  UnauthorizedErrorDefinition,
  UnsupportedMediaTypeErrorDefinition,
  ValidationErrorDefinition,
];
