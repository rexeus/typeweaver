# @rexeus/typeweaver-command

## 0.13.0

### Minor Changes

- 887c4b2: Add a generated Node.js command-line API client with one deterministic command per operation,
  path/query/header flags, inline/file/stdin request bodies, contract-derived security, structured
  output, stable exit codes, request cancellation, structured plugin diagnostics, and packed external
  consumer verification.

### Patch Changes

- b539a81: Preserve normalized body-warning locations as concrete validation JSON Pointers, and allow generated
  API operations named `version` because the command runtime has no conflicting version subcommand.
- 73fb710: Treat HTTP header names case-insensitively when request headers override client defaults, and encode
  generated command-client Basic credentials as UTF-8 before Base64 conversion.
- Updated dependencies [545331b]
- Updated dependencies [0f0ad74]
- Updated dependencies [33c3554]
- Updated dependencies [a83c79b]
- Updated dependencies [f4fd035]
- Updated dependencies [4ccbed1]
- Updated dependencies [b539a81]
- Updated dependencies [73fb710]
- Updated dependencies [450408d]
  - @rexeus/typeweaver-gen@0.13.0
  - @rexeus/typeweaver-clients@0.13.0
  - @rexeus/typeweaver-core@0.13.0

## 0.12.0

Initial package baseline. Public release changes are recorded through Changesets.
