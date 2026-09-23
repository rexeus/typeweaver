---
"@rexeus/typeweaver": patch
---

Load the CLI's Node platform layers and `runMain` from `@effect/platform-node-shared` and drop the
`@effect/platform-node` and `redis` dependencies. Installing the CLI no longer pulls in a Redis
client that it never used.
