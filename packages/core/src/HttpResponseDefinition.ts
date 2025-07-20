import type { HttpStatusCode } from "./HttpStatusCode";
import type { HttpHeaderSchema } from "./HttpHeader";
import type { HttpBodySchema } from "./HttpBody";
import z from "zod/v4";

export type IHttpResponseDefinition<
  TName extends string = string,
  TStatusCode extends HttpStatusCode = HttpStatusCode,
  TDescription extends string = string,
  THeader extends HttpHeaderSchema | undefined = HttpHeaderSchema | undefined,
  TBody extends HttpBodySchema | undefined = HttpBodySchema | undefined,
> = {
  name: TName;
  statusCode: TStatusCode;
  description: TDescription;
  header?: THeader;
  body?: TBody;
};

export type IExtendHttpResponseDefinition<
  TName extends string,
  TStatusCode extends HttpStatusCode,
  TDescription extends string,
  THeader extends HttpHeaderSchema | undefined,
  TBody extends HttpBodySchema | undefined,
> = Partial<
  IHttpResponseDefinition<TName, TStatusCode, TDescription, THeader, TBody>
> &
  Pick<
    IHttpResponseDefinition<TName, TStatusCode, TDescription, THeader, TBody>,
    "name"
  >;

export class HttpResponseDefinition<
  TName extends string,
  TStatusCode extends HttpStatusCode,
  TDescription extends string,
  THeader extends HttpHeaderSchema | undefined,
  TBody extends HttpBodySchema | undefined,
  TIsShared extends boolean,
> {
  public name: TName;
  public statusCode: TStatusCode;
  public description: TDescription;
  public header?: THeader;
  public body?: TBody;

  public constructor(
    private definition: IHttpResponseDefinition<
      TName,
      TStatusCode,
      TDescription,
      THeader,
      TBody
    >
  ) {
    this.name = definition.name;
    this.statusCode = definition.statusCode;
    this.description = definition.description;
    this.header = definition.header;
    this.body = definition.body;
  }

  public extend<
    EName extends string,
    EStatusCode extends HttpStatusCode = TStatusCode,
    EDescription extends string = TDescription,
    EHeader extends HttpHeaderSchema | undefined = THeader,
    EBody extends HttpBodySchema | undefined = TBody,
    EIsShared extends boolean = TIsShared,
  >(
    definition: IExtendHttpResponseDefinition<
      EName,
      EStatusCode,
      EDescription,
      EHeader,
      EBody
    >
  ): HttpResponseDefinition<
    EName,
    EStatusCode,
    EDescription,
    THeader extends undefined
      ? EHeader
      : EHeader extends undefined
        ? THeader
        : THeader & EHeader,
    TBody extends undefined
      ? EBody
      : EBody extends undefined
        ? TBody
        : TBody & EBody,
    EIsShared
  > {
    type MergedHeader = THeader extends undefined
      ? EHeader
      : EHeader extends undefined
        ? THeader
        : THeader & EHeader;

    type MergedBody = TBody extends undefined
      ? EBody
      : EBody extends undefined
        ? TBody
        : TBody & EBody;

    const mergedHeader = ((): MergedHeader | undefined => {
      if (!this.header && !definition.header) return undefined;
      if (!this.header) return definition.header as MergedHeader;
      if (!definition.header) return this.header as MergedHeader;
      return z.object({
        ...this.header.shape,
        ...definition.header.shape,
      }) as MergedHeader;
    })();

    const mergedBody = ((): MergedBody | undefined => {
      if (!this.body && !definition.body) return undefined;
      if (!this.body) return definition.body as MergedBody;
      if (!definition.body) return this.body as MergedBody;
      if (
        this.body instanceof z.ZodObject &&
        definition.body instanceof z.ZodObject
      ) {
        return z.object({
          ...this.body.shape,
          ...definition.body.shape,
        }) as unknown as MergedBody;
      }

      return definition.body as MergedBody;
    })();

    const baseDefinition: IHttpResponseDefinition<
      EName,
      EStatusCode,
      EDescription,
      MergedHeader,
      MergedBody
    > = {
      ...this.definition,
      name: definition.name as EName,
      statusCode: (definition.statusCode ?? this.statusCode) as EStatusCode,
      description: (definition.description ?? this.description) as EDescription,
      header: mergedHeader,
      body: mergedBody,
    };

    return new HttpResponseDefinition(baseDefinition);
  }
}
