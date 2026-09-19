---
"@rexeus/typeweaver": minor
---

Add a read-only `typeweaver generate --check` mode that performs a fresh isolated generation and
byte-compares it with the configured output. Matching output exits `0`; drift exits `1` with
deterministic, sorted `Added`, `Removed`, and `Changed` relative paths. The check never creates,
cleans, or writes the configured output directory, supports the config and explicit
`--input`/`--output`/`--plugins` workflows, snapshots committed output before generating under
`clean: false`, and keeps `--verbose` debug lifecycle and lock output.

Output locks are now flat entries directly under the platform system temp directory (POSIX `/tmp`,
root-owned sticky and world-writable; Windows the drive-independent
`\\?\GLOBALROOT\SystemRoot\Temp` namespace with inherited system-directory ACLs), named
`.typeweaver-output-lock-<hash>` from the physical output identity, so no CLI user owns a shared
parent and no lock artifact is written inside generated output. Lock directories are created `0700`
and metadata `0600`. The identity realpath-resolves the nearest existing ancestor (so symlink aliases
converge) and case-folds the whole canonical path on every platform, so a missing `Generated/Output`
and a later-created `generated/output` hash identically; conservative contention is preferred over
split locks. Staging directories are created directly under the trusted temp root and are removed on
success, failure, and interruption; normal generation creates output directories only after it holds
the lock.

Checks pin bare spec imports against the original `<configured output>/spec/spec.js` location before
isolated evaluation, so lookup order and fallback past a partial nearer `node_modules` match normal
generation without allowing the shared temp directory to inject packages. Non-literal dynamic
imports are rejected because their runtime target cannot be pinned safely. Configured output or
project source that equals the trusted temp root or uses a reserved coordination/staging name
(including lock fence names) is rejected before any lock or stage is created; ordinary project
outputs elsewhere under the temp root are unaffected. Only the CLI check pipeline can stage under
the reserved namespace via an internal, unforgeable authority.

Legacy remediation: a complete `.typeweaver-lock` whose regular metadata names a dead process is
proven coordination state that `--check` excludes and a later clean generation removes. A live,
malformed (including symlinked metadata), or ownership-uncertain lock blocks generate/check before
any clean and requires manual removal after confirming no older process runs. Fence-shaped
files/directories and other lookalikes are ordinary drift and clean-removable. Mixed CLI versions
must not run generation concurrently. See `MIGRATION.md`.
