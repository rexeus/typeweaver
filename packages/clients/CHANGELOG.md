# @rexeus/typeweaver-clients

## 0.6.0

### Minor Changes

- 10dc399: Replace built-in Prettier formatter with oxfmt

  The `--prettier` / `--no-prettier` CLI flags have been renamed to `--format` / `--no-format`. The `prettier` config option is now `format`. Generated code is now formatted using oxfmt instead of Prettier.

### Patch Changes

- Updated dependencies [10dc399]
  - @rexeus/typeweaver-zod-to-ts@0.6.0
  - @rexeus/typeweaver-core@0.6.0
  - @rexeus/typeweaver-gen@0.6.0

## 0.5.1

### Patch Changes

- @rexeus/typeweaver-core@0.5.1
- @rexeus/typeweaver-gen@0.5.1
- @rexeus/typeweaver-zod-to-ts@0.5.1

## 0.5.0

### Minor Changes

- d2bb619: - Replace axios with native fetch API.
  - The fetchFn prop on ApiClientProps allows injecting a custom fetch implementation.
  - Response header validation now correctly splits comma-delimited values per RFC 7230 when the
    schema expects an array.

### Patch Changes

- Updated dependencies [d2bb619]
  - @rexeus/typeweaver-zod-to-ts@0.5.0
  - @rexeus/typeweaver-core@0.5.0
  - @rexeus/typeweaver-gen@0.5.0

## 0.4.2

### Patch Changes

- 3208c25: - Fix ApiClient URL construction to support relative base paths
  - ApiClient now uses string concatenation instead of `new URL()` for path construction, allowing
    relative base paths like `/api` without requiring a full origin URL.
- 645a4bb: Fix baseUrls in clients
- Updated dependencies [645a4bb]
  - @rexeus/typeweaver-zod-to-ts@0.4.2
  - @rexeus/typeweaver-core@0.4.2
  - @rexeus/typeweaver-gen@0.4.2

## 0.4.1

### Patch Changes

- 3d939a2: - Fix ApiClient URL construction to support relative base paths
  - ApiClient now uses string concatenation instead of `new URL()` for path construction, allowing
    relative base paths like `/api` without requiring a full origin URL.
  - @rexeus/typeweaver-core@0.4.1
  - @rexeus/typeweaver-gen@0.4.1
  - @rexeus/typeweaver-zod-to-ts@0.4.1

## 0.4.0

### Minor Changes

- 4c96840: Improve bundling

### Patch Changes

- Updated dependencies [4c96840]
  - @rexeus/typeweaver-zod-to-ts@0.4.0
  - @rexeus/typeweaver-core@0.4.0
  - @rexeus/typeweaver-gen@0.4.0

## 0.3.2

### Patch Changes

- b49b9d6: Fix undefined query strings in client
  - @rexeus/typeweaver-core@0.3.2
  - @rexeus/typeweaver-gen@0.3.2
  - @rexeus/typeweaver-zod-to-ts@0.3.2

## 0.3.1

### Patch Changes

- @rexeus/typeweaver-core@0.3.1
- @rexeus/typeweaver-gen@0.3.1
- @rexeus/typeweaver-zod-to-ts@0.3.1

## 0.3.0

### Minor Changes

- 76b2a3b: - Add support for Bun & Deno
  - Add support for Commonjs in addition to ESM

### Patch Changes

- Updated dependencies [76b2a3b]
  - @rexeus/typeweaver-zod-to-ts@0.3.0
  - @rexeus/typeweaver-core@0.3.0
  - @rexeus/typeweaver-gen@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [77fb21d]
  - @rexeus/typeweaver-core@0.2.1
  - @rexeus/typeweaver-gen@0.2.1
  - @rexeus/typeweaver-zod-to-ts@0.2.1

## 0.2.0

### Minor Changes

- 35be4c9: - Improve package descriptions
  - Update all dependencies to latest versions

### Patch Changes

- Updated dependencies [35be4c9]
  - @rexeus/typeweaver-zod-to-ts@0.2.0
  - @rexeus/typeweaver-core@0.2.0
  - @rexeus/typeweaver-gen@0.2.0

## 0.1.2

### Patch Changes

- Updated dependencies [95beee9]
  - @rexeus/typeweaver-core@0.1.2
  - @rexeus/typeweaver-gen@0.1.2
  - @rexeus/typeweaver-zod-to-ts@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [f1ccb30]
  - @rexeus/typeweaver-core@0.1.1
  - @rexeus/typeweaver-gen@0.1.1
  - @rexeus/typeweaver-zod-to-ts@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [73fc785]
  - @rexeus/typeweaver-zod-to-ts@0.1.0
  - @rexeus/typeweaver-core@0.1.0
  - @rexeus/typeweaver-gen@0.1.0

## 0.0.4

### Patch Changes

- c46bfc2: Provide more details in ResponseValidationErrors about specific responses and improve
  ResponseValidators
- f9437df: Improve header & query param handling in clients and hono routers.
- 74f411f: Definitions are now embedded in generated code, so the output is self-contained.
- 4e5b0ea: Support entity-scoped responses & nested input dirs.
- eebc31d: Make unknown response handling in clients configurable
- e564680: Fix issue with shared and entity-based responses
- c46bfc2: Improve client handling of UnknownResponses
- Updated dependencies [84c8f9f]
- Updated dependencies [c46bfc2]
- Updated dependencies [4e5b0ea]
- Updated dependencies [e564680]
- Updated dependencies [2ec3eaf]
- Updated dependencies [c46bfc2]
  - @rexeus/typeweaver-gen@0.0.4
  - @rexeus/typeweaver-core@0.0.4
  - @rexeus/typeweaver-zod-to-ts@0.0.4

## 0.0.3

### Patch Changes

- 7324748: Fix issue when single plugins are used. There were dependencies between the plugins which
  now have been resolved.
- Updated dependencies [7324748]
  - @rexeus/typeweaver-zod-to-ts@0.0.3
  - @rexeus/typeweaver-core@0.0.3
  - @rexeus/typeweaver-gen@0.0.3

## 0.0.2

### Patch Changes

- 306bdec: Update package.json exports & add bin command

## 0.0.1

### Patch Changes

- 90182b3: Initial version
