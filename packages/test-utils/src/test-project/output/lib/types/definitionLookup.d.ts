import type { ResponseDefinition, SpecDefinition } from "@rexeus/typeweaver-core";

type MatchedOperationDefinition<
  TSpec extends SpecDefinition,
  TResourceName extends keyof TSpec["resources"] & string,
  TOperationId extends string,
> =
  Extract<
    NonNullable<TSpec["resources"][TResourceName]>["operations"][number],
    { readonly operationId: TOperationId }
  > extends never
    ? NonNullable<TSpec["resources"][TResourceName]>["operations"][number]
    : Extract<
        NonNullable<TSpec["resources"][TResourceName]>["operations"][number],
        { readonly operationId: TOperationId }
      >;

type MatchedResponseDefinition<TResponses extends readonly ResponseDefinition[]> =
  TResponses[number];

export declare const getOperationDefinition: <
  TSpec extends SpecDefinition,
  TResourceName extends keyof TSpec["resources"] & string,
  TOperationId extends string,
>(
  spec: TSpec,
  resourceName: TResourceName,
  operationId: TOperationId,
) => MatchedOperationDefinition<TSpec, TResourceName, TOperationId>;

export declare const getResponseDefinition: <TResponses extends readonly ResponseDefinition[]>(
  responses: TResponses,
  responseName: string,
) => MatchedResponseDefinition<TResponses>;
