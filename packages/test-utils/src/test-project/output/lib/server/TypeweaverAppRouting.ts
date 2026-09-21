import { Router } from "./Router.js";
import type { ErasedRequestHandler } from "./RequestHandler.js";
import type { TypeweaverRouter } from "./TypeweaverRouter.js";

export function mountAppRouter(
  target: Router,
  router: TypeweaverRouter<Record<string, ErasedRequestHandler>>,
  prefix?: string,
): void {
  const normalizedPrefix = trimTrailingSlashes(prefix);
  for (const route of router.getRoutes()) {
    target.add({
      ...route,
      path: normalizedPrefix ? normalizedPrefix + route.path : route.path,
    });
  }
}

function trimTrailingSlashes(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return end === value.length ? value : value.slice(0, end);
}
