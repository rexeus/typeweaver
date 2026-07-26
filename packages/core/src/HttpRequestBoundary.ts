import type { RequestDefinition } from "./RequestDefinition.js";
import type { z } from "zod";

export type ClientHttpScalar = string | number | boolean | bigint | Date;

export type ClientHttpParam =
  | Readonly<Record<string, ClientHttpScalar>>
  | undefined;

export type ClientHttpQuery =
  | Readonly<
      Record<string, ClientHttpScalar | readonly ClientHttpScalar[] | undefined>
    >
  | undefined;

export type ClientHttpHeader = ClientHttpQuery;

type BoundaryPart = "request.header" | "request.param" | "request.query";

type IsAny<T> = 0 extends 1 & T ? true : false;

type DefinedInput<TInput> = Exclude<TInput, undefined>;

type AcceptsRawScalar<TInput> =
  string extends DefinedInput<TInput>
    ? true
    : DefinedInput<TInput> extends string
      ? true
      : false;

type AcceptsRawArray<TInput> =
  string[] extends DefinedInput<TInput>
    ? true
    : DefinedInput<TInput> extends readonly string[]
      ? true
      : false;

type DefinedOutput<TSchema> = Exclude<z.output<TSchema>, undefined>;

type FieldOutputKind<TSchema> =
  IsAny<z.output<TSchema>> extends true
    ? "unsupported"
    : DefinedOutput<TSchema> extends ClientHttpScalar
      ? "scalar"
      : DefinedOutput<TSchema> extends readonly ClientHttpScalar[]
        ? "array"
        : "unsupported";

type FieldIssue<
  TSchema,
  TPart extends BoundaryPart,
  TName extends string,
  TAllowArray extends boolean,
> =
  FieldOutputKind<TSchema> extends "scalar"
    ? AcceptsRawScalar<z.input<TSchema>> extends true
      ? never
      : `${TPart}.${TName} must accept a raw HTTP string`
    : FieldOutputKind<TSchema> extends "array"
      ? TAllowArray extends true
        ? AcceptsRawArray<z.input<TSchema>> extends true
          ? never
          : `${TPart}.${TName} must accept a raw HTTP string array`
        : `${TPart}.${TName} must produce a scalar value`
      : `${TPart}.${TName} must produce an HTTP client scalar or scalar array`;

type ObjectIssues<
  TShape extends z.core.$ZodShape,
  TPart extends BoundaryPart,
  TAllowArray extends boolean,
> = string extends keyof TShape
  ? never
  : {
      [TName in keyof TShape & string]: FieldIssue<
        TShape[TName],
        TPart,
        TName,
        TAllowArray
      >;
    }[keyof TShape & string];

type RecordIssues<
  TKey extends z.core.$ZodRecordKey,
  TValue,
  TPart extends BoundaryPart,
  TAllowArray extends boolean,
> =
  unknown extends z.output<TValue>
    ? never
    :
        | (AcceptsRawScalar<z.input<TKey>> extends true
            ? z.output<TKey> extends string
              ? never
              : `${TPart} record keys must produce strings`
            : `${TPart} record keys must accept strings`)
        | FieldIssue<TValue, TPart, "<record-value>", TAllowArray>;

type ContainerIssues<
  TSchema,
  TPart extends BoundaryPart,
  TAllowArray extends boolean,
> = TSchema extends undefined
  ? never
  : TSchema extends z.ZodOptional<infer TInner>
    ? ContainerIssues<TInner, TPart, TAllowArray>
    : TSchema extends z.ZodObject<infer TShape>
      ? ObjectIssues<TShape, TPart, TAllowArray>
      : TSchema extends z.ZodRecord<infer TKey, infer TValue>
        ? RecordIssues<TKey, TValue, TPart, TAllowArray>
        : `${TPart} must be a Zod object or record schema`;

type HttpRequestBoundaryIssuesFor<TRequest extends RequestDefinition> =
  | ("param" extends keyof TRequest
      ? ContainerIssues<TRequest["param"], "request.param", false>
      : never)
  | ("query" extends keyof TRequest
      ? ContainerIssues<TRequest["query"], "request.query", true>
      : never)
  | ("header" extends keyof TRequest
      ? ContainerIssues<TRequest["header"], "request.header", true>
      : never);

export type HttpRequestBoundaryIssues<TRequest extends RequestDefinition> =
  TRequest extends RequestDefinition
    ? HttpRequestBoundaryIssuesFor<TRequest>
    : never;

export type HttpRequestBoundaryConstraint<TRequest extends RequestDefinition> =
  [HttpRequestBoundaryIssues<TRequest>] extends [never]
    ? unknown
    : {
        readonly __typeweaverHttpBoundaryError__: HttpRequestBoundaryIssues<TRequest>;
      };
