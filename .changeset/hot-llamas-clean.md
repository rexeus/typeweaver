---
"@rexeus/typeweaver": minor
"@rexeus/typeweaver-gen": patch
---

Add `validate`, `doctor`, `init`, `migrate`, and `--dry-run` to the CLI.

This improves onboarding and diagnostics with clearer command flows,
structured feedback, and better error reporting for generation issues.

Validation now surfaces plugin load failures explicitly, `init` rolls back
partially created files and directories on failure, `migrate` skips
unparseable installed version specifiers, and watch mode ignores late file
events after shutdown.
