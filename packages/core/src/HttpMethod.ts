export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
  OPTIONS = "OPTIONS",
  HEAD = "HEAD",
}

const HTTP_METHODS: readonly string[] = Object.values(HttpMethod);

/**
 * Narrows a method token to a supported `HttpMethod`. Tokens are
 * case-sensitive; upper-case a Fetch or Node method before checking it.
 */
export const isHttpMethod = (method: string): method is HttpMethod =>
  HTTP_METHODS.includes(method);
