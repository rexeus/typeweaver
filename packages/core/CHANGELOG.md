# @rexeus/typeweaver-core

## 0.6.4

### Patch Changes

- bee197f: Normalize custom `headerName` option to lowercase in `requestId` middleware so that
  mixed-case values like `"X-Request-Id"` match HTTP-layer-normalized headers correctly

## 0.6.3

### Patch Changes

- be839c7: Widen remaining bare `RequestHandler` types in `RouteDefinition` and
  `TypeweaverRouter.route()` to `RequestHandler<any, any, any>`

## 0.6.2

### Patch Changes

- 9fbe741: Widen `RequestHandler` constraint in `TypeweaverApp.route()` from bare `RequestHandler`
  to `RequestHandler<any, any, any>` to resolve contravariance error under `strictFunctionTypes`

## 0.6.1

## 0.6.0

### Minor Changes

- 10dc399: Replace built-in Prettier formatter with oxfmt

  The `--prettier` / `--no-prettier` CLI flags have been renamed to `--format` / `--no-format`. The
  `prettier` config option is now `format`. Generated code is now formatted using oxfmt instead of
  Prettier.

## 0.5.1

## 0.5.0

### Minor Changes

- d2bb619: - Replace axios with native fetch API.
  - The fetchFn prop on ApiClientProps allows injecting a custom fetch implementation.
  - Response header validation now correctly splits comma-delimited values per RFC 7230 when the
    schema expects an array.

## 0.4.2

### Patch Changes

- 645a4bb: Fix baseUrls in clients

## 0.4.1

## 0.4.0

### Minor Changes

- 4c96840: Improve bundling

## 0.3.2

## 0.3.1

## 0.3.0

### Minor Changes

- 76b2a3b: - Add support for Bun & Deno
  - Add support for Commonjs in addition to ESM

## 0.2.1

### Patch Changes

- 77fb21d: - Support 3xx HTTP status codes
  - Support zod records in headers and queries

## 0.2.0

### Minor Changes

- 35be4c9: - Improve package descriptions
  - Update all dependencies to latest versions

## 0.1.2

### Patch Changes

- 95beee9: Solve issue with optional headers

## 0.1.1

### Patch Changes

- f1ccb30: Solve issue with optional query params

## 0.1.0

### Minor Changes

- 73fc785: Support zod v4

## 0.0.4

### Patch Changes

- c46bfc2: Provide more details in ResponseValidationErrors about specific responses and improve
  ResponseValidators
- 4e5b0ea: Support entity-scoped responses & nested input dirs.
- e564680: Fix issue with shared and entity-based responses
- 2ec3eaf: Drop http method support for trace & connect
- c46bfc2: Improve client handling of UnknownResponses

## 0.0.3

### Patch Changes

- 7324748: Fix issue when single plugins are used. There were dependencies between the plugins which
  now have been resolved.

## 0.0.2

### Patch Changes

- 306bdec: Update package.json exports & add bin command

## 0.0.1

### Patch Changes

- 90182b3: Initial version
