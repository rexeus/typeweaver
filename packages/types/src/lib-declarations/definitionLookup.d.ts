import type {
  ResponseDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";

type MatchedOperationDefinition<
  TSpec extends SpecDefinition,
  TResourceName extends keyof TSpec["resources"] & string,
> = NonNullable<TSpec["resources"][TResourceName]>["operations"][number];

type MatchedResponseDefinition<
  TResponses extends readonly ResponseDefinition[],
> = TResponses[number];

export declare const getOperationDefinition: <
  TSpec extends SpecDefinition,
  TResourceName extends keyof TSpec["resources"] & string,
>(
  spec: TSpec,
  resourceName: TResourceName,
  operationId: string
) => MatchedOperationDefinition<TSpec, TResourceName>;

export declare const getResponseDefinition: <
  TResponses extends readonly ResponseDefinition[],
>(
  responses: TResponses,
  responseName: string
) => MatchedResponseDefinition<TResponses>;
