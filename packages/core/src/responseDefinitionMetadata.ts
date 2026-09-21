import { responseDefinitionMetadataSymbol } from "./responseDefinitionTypes.js";
import type {
  ResponseDefinition,
  ResponseDefinitionMetadata,
} from "./responseDefinitionTypes.js";

export class ResponseDefinitionMergeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ResponseDefinitionMergeError";
  }
}

const defineResponseDefinitionMetadata = (
  response: ResponseDefinition,
  metadata: ResponseDefinitionMetadata
): void => {
  Object.defineProperty(response, responseDefinitionMetadataSymbol, {
    value: metadata,
    enumerable: false,
    configurable: false,
    writable: false,
  });
};

const cloneResponseDefinitionWithoutMetadata = <
  TResponse extends ResponseDefinition,
>(
  response: TResponse
): TResponse => {
  const descriptors: PropertyDescriptorMap = {};
  for (const key of Reflect.ownKeys(response)) {
    if (key === responseDefinitionMetadataSymbol) continue;
    const descriptor = Object.getOwnPropertyDescriptor(response, key);
    if (descriptor !== undefined) descriptors[key] = descriptor;
  }
  return Object.create(
    Reflect.getPrototypeOf(response),
    descriptors
  ) as TResponse;
};

export const attachResponseDefinitionMetadata = <
  TResponse extends ResponseDefinition,
>(
  response: TResponse,
  metadata: ResponseDefinitionMetadata
): TResponse => {
  try {
    defineResponseDefinitionMetadata(response, metadata);
    return response;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  const clonedResponse = cloneResponseDefinitionWithoutMetadata(response);
  defineResponseDefinitionMetadata(clonedResponse, metadata);
  return clonedResponse;
};

export const getResponseDefinitionMetadata = (
  response: ResponseDefinition
): ResponseDefinitionMetadata | undefined =>
  response[responseDefinitionMetadataSymbol];

export const isNamedResponseDefinition = (
  response: ResponseDefinition
): boolean => getResponseDefinitionMetadata(response) !== undefined;
