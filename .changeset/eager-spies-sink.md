---
"@rexeus/typeweaver-aws-cdk": minor
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver": minor
"@rexeus/typeweaver-gen": minor
---

### Supply chain hardening

- Replace `ejs` dependency with a zero-dependency template engine
- Replace `case` dependency with built-in `toPascalCase` and `toCamelCase` utilities
- Remove `tsx` from production dependencies; TypeScript config files (`.ts`, `.mts`, `.cts`) are no longer supported by the published CLI
- Add clean safety guards to prevent destructive `rm` on workspace roots
- Enable npm provenance on publish

### Naming convention validation

- Validate `operationId` and `resourceName` during spec normalization
- Reject `snake_case` and `kebab-case` identifiers with dedicated error types (`InvalidOperationIdError`, `InvalidResourceNameError`)
- Supported formats: camelCase (preferred) and PascalCase (for compatibility)
