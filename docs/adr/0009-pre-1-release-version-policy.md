# ADR 0009: Pre-1.0 Release Version Policy

## Status

Accepted

## Context

TypeWeaver remains an early-stage project working toward a deliberate stable 1.0 release. The Effect
migration contains breaking public changes, but it does not mark that stability milestone. The next
coordinated package release after `0.12.0` is therefore `0.13.0`.

The repository patches `@changesets/assemble-release-plan` to prevent peer-dependency propagation
from automatically promoting dependents to a major release. That patch intentionally does not
override a `major` release written directly into Changesets frontmatter. An explicit `major` entry
therefore still produces `1.0.0`.

## Decision

1. Published `@rexeus/*` packages remain on major version `0` until an explicit stability decision
   changes `config/release-policy.json`.
2. Breaking changes during this period use a Changesets `minor` bump. From `0.12.0`, the Effect
   migration therefore releases as `0.13.0`.
3. The existing Changesets patch remains responsible only for suppressing false major bumps caused
   by peer-dependency propagation.
4. `pnpm verify:release-version` rejects both:
   - pending explicit `major` Changesets while the configured release line is `0.x`; and
   - generated package manifests whose version exceeds the configured major.
5. `pnpm verify:architecture-contracts` runs the release-version contract on normal pull requests
   and generated Changesets release pull requests.

## Consequences

- A breaking pre-1.0 release remains visible as a minor version change.
- An accidental `1.0.0` plan fails before merge, even if it originated outside peer-dependency
  propagation.
- Releasing 1.0 requires an intentional policy change, migration review, and corresponding
  documentation update rather than a lone Changeset entry.
