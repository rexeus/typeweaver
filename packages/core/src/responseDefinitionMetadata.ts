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
  response: object,
  metadata: ResponseDefinitionMetadata
): void => {
  Object.defineProperty(response, responseDefinitionMetadataSymbol, {
    value: metadata,
    enumerable: false,
    configurable: false,
    writable: false,
  });
};

const cloneResponseDefinitionWithoutMetadata = (
  response: ResponseDefinition
): object => {
  const descriptors: PropertyDescriptorMap = {};
  for (const key of Reflect.ownKeys(response)) {
    if (key === responseDefinitionMetadataSymbol) continue;
    const descriptor = Object.getOwnPropertyDescriptor(response, key);
    if (descriptor !== undefined) descriptors[key] = descriptor;
  }
  const clonedResponse = {};
  Object.setPrototypeOf(clonedResponse, Reflect.getPrototypeOf(response));
  return Object.defineProperties(clonedResponse, descriptors);
};

/**
 * Returns the response itself, or a same-prototype copy of all its own
 * properties when it cannot be extended, so the result is always a `TResponse`.
 */
export function attachResponseDefinitionMetadata<
  TResponse extends ResponseDefinition,
>(response: TResponse, metadata: ResponseDefinitionMetadata): TResponse;
export function attachResponseDefinitionMetadata(
  response: ResponseDefinition,
  metadata: ResponseDefinitionMetadata
): object {
  try {
    defineResponseDefinitionMetadata(response, metadata);
    return response;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  const clonedResponse = cloneResponseDefinitionWithoutMetadata(response);
  defineResponseDefinitionMetadata(clonedResponse, metadata);
  return clonedResponse;
}

export const getResponseDefinitionMetadata = (
  response: ResponseDefinition
): ResponseDefinitionMetadata | undefined =>
  response[responseDefinitionMetadataSymbol];

export const isNamedResponseDefinition = (
  response: ResponseDefinition
): boolean => getResponseDefinitionMetadata(response) !== undefined;
