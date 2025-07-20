import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type PutSpecimenResponse,
  PutSpecimenSuccessResponse,
} from "./PutSpecimenResponse";

import { SpecimenConflictErrorResponse } from "./SpecimenConflictErrorResponse";

import { SpecimenNotFoundErrorResponse } from "./SpecimenNotFoundErrorResponse";

import { SpecimenUnprocessableEntityErrorResponse } from "./SpecimenUnprocessableEntityErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IPutSpecimenRequestHeader = {
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

export type IPutSpecimenRequestParam = {
  specimenId: string;
  foo: "foo1" | "foo2";
  bar: "bar";
  uuid: string;
  slug: string;
};

export type IPutSpecimenRequestQuery = {
  foo: string;
  bar?: string | undefined;
  baz: "baz";
  qux?: ("qux1" | "qux2") | undefined;
  quux: string[];
  email: string;
  numbers?: string[] | undefined;
  ulid?: string | undefined;
  urls: string[];
};

export type IPutSpecimenRequestBody = {
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

export type IPutSpecimenRequest = {
  path: string;
  method: HttpMethod.PUT;
  header: IPutSpecimenRequestHeader;
  param: IPutSpecimenRequestParam;
  query: IPutSpecimenRequestQuery;
  body: IPutSpecimenRequestBody;
};

export type SuccessfulPutSpecimenResponse = Exclude<
  PutSpecimenResponse,
  | SpecimenConflictErrorResponse
  | SpecimenNotFoundErrorResponse
  | SpecimenUnprocessableEntityErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
