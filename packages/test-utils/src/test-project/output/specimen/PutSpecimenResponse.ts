import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  ISpecimenConflictErrorResponse,
  SpecimenConflictErrorResponse,
} from "./SpecimenConflictErrorResponse";

import type {
  ISpecimenNotFoundErrorResponse,
  SpecimenNotFoundErrorResponse,
} from "./SpecimenNotFoundErrorResponse";

import type {
  ISpecimenUnprocessableEntityErrorResponse,
  SpecimenUnprocessableEntityErrorResponse,
} from "./SpecimenUnprocessableEntityErrorResponse";

import type {
  IForbiddenErrorResponse,
  ForbiddenErrorResponse,
} from "../shared/ForbiddenErrorResponse";

import type {
  IInternalServerErrorResponse,
  InternalServerErrorResponse,
} from "../shared/InternalServerErrorResponse";

import type {
  ITooManyRequestsErrorResponse,
  TooManyRequestsErrorResponse,
} from "../shared/TooManyRequestsErrorResponse";

import type {
  IUnauthorizedErrorResponse,
  UnauthorizedErrorResponse,
} from "../shared/UnauthorizedErrorResponse";

import type {
  IUnsupportedMediaTypeErrorResponse,
  UnsupportedMediaTypeErrorResponse,
} from "../shared/UnsupportedMediaTypeErrorResponse";

import type {
  IValidationErrorResponse,
  ValidationErrorResponse,
} from "../shared/ValidationErrorResponse";

export type IPutSpecimenSuccessResponseHeader = {
  "X-Foo": string;
  "X-Bar"?: string | undefined;
  "X-Baz": "baz";
  "X-Qux"?: ("qux1" | "qux2") | undefined;
  "X-Quux": string[];
  "X-UUID": string;
  "X-JWT"?: string | undefined;
  "X-URL": string;
  "X-Email"?: string | undefined;
  "X-Slugs": string[];
};

export type IPutSpecimenSuccessResponseBody = {
  stringField: string;
  numberField: number;
  booleanField: boolean;
  bigintField: bigint;
  dateField: Date;
  undefinedField: undefined;
  nullField: null;
  voidField: void;
  anyField: any;
  unknownField: unknown;
  symbolField: symbol;
  nanField: unknown;
  emailField: string;
  uuidv4Field: string;
  uuidv7Field: string;
  ipv4Field: string;
  ipv6Field: string;
  cidrv4Field: string;
  cidrv6Field: string;
  urlField: string;
  e164Field: string;
  base64Field: string;
  base64urlField: string;
  lowercaseField: unknown;
  isoDateField: string;
  isoDateTimeField: string;
  isoDurationField: string;
  isoTimeField: string;
  ulidField: string;
  uuidField: string;
  emojiField: string;
  nanoidField: string;
  cuidField: string;
  cuid2Field: string;
  jwtField: string;
  literalField: "test";
  enumField: "ACTIVE" | "INACTIVE" | "PENDING";
  templateLiteralField: unknown;
  arrayField: string[];
  tupleField: [string, number, boolean];
  setField: Set<string>;
  mapField: Map<string, number>;
  recordField: Record<string, number>;
  objectField: {
    name: string;
    value: number;
  };
  nestedObjectField: {
    level1: {
      level2: string;
    };
  };
  optionalField?: string | undefined;
  nullableField: string | null;
  readonlyField: unknown;
  nonOptionalField: unknown;
  unionField: string | number;
  intersectionField: {
    a: string;
  } & {
    b: number;
  };
  transformField: unknown;
  defaultField: string;
  catchField: unknown;
  pipeField: unknown;
  lazyField: unknown;
  promiseField: Promise<string>;
  fileField: unknown;
  customField: unknown;
  createdAt: string;
  modifiedAt: string;
  createdBy: string;
  modifiedBy: string;
};

export type IPutSpecimenSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IPutSpecimenSuccessResponseHeader;
  body: IPutSpecimenSuccessResponseBody;
};

export class PutSpecimenSuccessResponse
  extends HttpResponse<
    IPutSpecimenSuccessResponseHeader,
    IPutSpecimenSuccessResponseBody
  >
  implements IPutSpecimenSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IPutSpecimenSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for PutSpecimenSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IPutSpecimenSuccessResponses = IPutSpecimenSuccessResponse;

export type PutSpecimenSuccessResponses = PutSpecimenSuccessResponse;

export type IPutSpecimenResponse =
  | IPutSpecimenSuccessResponse
  | ISpecimenConflictErrorResponse
  | ISpecimenNotFoundErrorResponse
  | ISpecimenUnprocessableEntityErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type PutSpecimenResponse =
  | PutSpecimenSuccessResponse
  | SpecimenConflictErrorResponse
  | SpecimenNotFoundErrorResponse
  | SpecimenUnprocessableEntityErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
