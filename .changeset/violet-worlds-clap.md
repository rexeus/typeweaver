---
"@rexeus/typeweaver-zod-to-ts": minor
"@rexeus/typeweaver-aws-cdk": minor
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver": minor
"@rexeus/typeweaver-gen": minor
---

Replace built-in Prettier formatter with oxfmt

The `--prettier` / `--no-prettier` CLI flags have been renamed to `--format` / `--no-format`. The `prettier` config option is now `format`. Generated code is now formatted using oxfmt instead of Prettier.
