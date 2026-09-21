import type { ClientHttpParam, ClientHttpQuery } from "@rexeus/typeweaver-core";
import { buildQueryString } from "./apiClientQuery.js";
import { serializeHttpScalar } from "./apiClientSerialization.js";
import { ApiClientConfigurationError } from "./errors/ApiClientConfigurationError.js";
import { PathParameterError } from "./PathParameterError.js";

const PATH_PARAMETER_PATTERN = /:([A-Za-z0-9_]+)/g;
const LEADING_URI_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const DELETE_CONTROL_CHARACTER_CODE = 0x7f;
const SPACE_CHARACTER_CODE = 0x20;

type PathParameters = NonNullable<ClientHttpParam>;

export function createPath(path: string, param?: ClientHttpParam): string {
  const pathParameterSet = new Set(getPathParameterNames(path));
  const parameters: PathParameters = param ?? {};

  assertNoUnexpectedPathParameters(path, pathParameterSet, parameters);
  assertNoMissingPathParameters(path, pathParameterSet, parameters);

  return path.replace(
    PATH_PARAMETER_PATTERN,
    (placeholder, key: string, offset: number) =>
      encodePathParameter(
        key,
        parameters[key],
        path,
        followingStaticDelimiter(path, offset + placeholder.length)
      )
  );
}

export function createUrl(
  path: string,
  query: ClientHttpQuery | undefined,
  defaultQuery: Readonly<Record<string, string>>
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const queryString = buildQueryString(query, defaultQuery);
  return queryString ? `${normalizedPath}?${queryString}` : normalizedPath;
}

export function buildFullUrl(baseUrl: string, relativePath: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${base}${path}`;
}

export function assertValidBaseUrl(baseUrl: string): void {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new ApiClientConfigurationError("baseUrl", "missing-base-url", {
      baseUrl,
    });
  }

  const validationError = getBaseUrlValidationError(baseUrl);
  if (validationError !== undefined) {
    throw new ApiClientConfigurationError("baseUrl", validationError.reason, {
      baseUrl,
      ...(validationError.scheme === undefined
        ? {}
        : { scheme: validationError.scheme }),
    });
  }
}

function getBaseUrlValidationError(baseUrl: string):
  | {
      readonly reason: "malformed-base-url" | "unsupported-base-url-scheme";
      readonly scheme?: string | undefined;
    }
  | undefined {
  const scheme = getBaseUrlScheme(baseUrl);

  if (hasAsciiControlCharacter(baseUrl)) {
    return { reason: "malformed-base-url", scheme };
  }

  const normalizedBaseUrl = baseUrl.trim();
  if (!LEADING_URI_SCHEME_PATTERN.test(normalizedBaseUrl)) {
    return undefined;
  }

  if (!URL.canParse(normalizedBaseUrl)) {
    return { reason: "malformed-base-url", scheme };
  }

  const url = new URL(normalizedBaseUrl);
  if (url.protocol === "http:" || url.protocol === "https:") {
    return undefined;
  }

  return { reason: "unsupported-base-url-scheme", scheme };
}

function getBaseUrlScheme(baseUrl: string): string | undefined {
  const normalizedBaseUrl = baseUrl.trim();
  const schemeMatch = LEADING_URI_SCHEME_PATTERN.exec(normalizedBaseUrl);

  if (schemeMatch?.[0] === undefined) {
    return undefined;
  }

  return schemeMatch[0].slice(0, -1).toLowerCase();
}

function getPathParameterNames(path: string): readonly string[] {
  const names: string[] = [];
  for (const match of path.matchAll(PATH_PARAMETER_PATTERN)) {
    const name = match[1];
    if (name !== undefined) {
      names.push(name);
    }
  }
  return names;
}

function followingStaticDelimiter(
  path: string,
  placeholderEnd: number
): string | undefined {
  const remainder = path.slice(placeholderEnd);
  if (remainder.length === 0 || remainder.startsWith("/")) return undefined;

  return Array.from(remainder)[0];
}

function assertNoUnexpectedPathParameters(
  path: string,
  pathParameterNames: ReadonlySet<string>,
  parameters: PathParameters
): void {
  for (const key of Object.keys(parameters)) {
    if (!pathParameterNames.has(key)) {
      throw new PathParameterError(
        `Path parameter '${key}' is not found in path '${path}'`,
        key,
        path
      );
    }
  }
}

function assertNoMissingPathParameters(
  path: string,
  pathParameterNames: ReadonlySet<string>,
  parameters: PathParameters
): void {
  for (const key of pathParameterNames) {
    if (!Object.hasOwn(parameters, key) || parameters[key] === undefined) {
      throw new PathParameterError(
        `Path parameter '${key}' is missing for path '${path}'`,
        key,
        path
      );
    }
  }
}

function encodePathParameter(
  key: string,
  value: unknown,
  path: string,
  followingStaticDelimiterValue?: string
): string {
  const serialized = serializeHttpScalar(value, "path", key);
  if (serialized === "." || serialized === "..") {
    throw new PathParameterError(
      `Path parameter '${key}' cannot be a URL dot-segment`,
      key,
      path
    );
  }

  if (followingStaticDelimiterValue === undefined) {
    return encodeURIComponent(serialized);
  }

  return serialized
    .split(followingStaticDelimiterValue)
    .map(part => encodeURIComponent(part))
    .join(percentEncode(followingStaticDelimiterValue));
}

function percentEncode(value: string): string {
  return Array.from(
    new TextEncoder().encode(value),
    byte => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`
  ).join("");
}

function hasAsciiControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index);
    if (
      characterCode < SPACE_CHARACTER_CODE ||
      characterCode === DELETE_CONTROL_CHARACTER_CODE
    ) {
      return true;
    }
  }

  return false;
}
