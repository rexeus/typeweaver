# Roadmap

## Where the project stands

Typeweaver is no longer in the "promising but rough" phase. The core idea has held up, the package
layout is more mature, and the project now has a much stronger implementation and testing base than
it did in the v0.7.0 era.

That changes the roadmap. The biggest questions are no longer about whether the architecture works.
They are about making the product easier to adopt, easier to trust, and easier to operate day to
day.

## What has already landed

Some items that used to belong on the roadmap are effectively done:

- **Reserved keyword handling** is no longer a known gap.
- **Watch mode** exists and meaningfully improves the authoring loop.
- **Generated Hono coverage** is much stronger, and the generated/test story overall is far more
  credible than before.

These are good signs. They show the project is moving from core capability work toward polish,
confidence, and adoption.

## What is partially addressed

The next layer is not missing from the product, but it is not yet where it should be.

### Error handling and diagnostics

Typeweaver already has solid internal error modeling, but the user-facing experience should go
further. Errors should explain what went wrong, where it went wrong, and what to do next. That is
the path to trust.

This is also where **`typeweaver doctor`** and stronger config diagnostics belong. Configuration
problems, plugin mismatches, invalid paths, and environment issues should be easy to diagnose
without reading source code or stepping through the CLI.

### CLI feedback and safe iteration

Generation works, but the CLI can still do a better job of showing intent and results. Clearer
output, better summaries, warnings that stand out, and more obvious success/failure reporting would
make the tool feel calmer and more professional.

That same theme points to a **dry-run / preview mode**: users should be able to see what would be
generated before files change on disk.

### Coverage depth in `zod-to-ts`

Support is much better than it used to be, but further **`zod-to-ts` coverage improvements** still
matter. Every fallback to a vague generated type weakens confidence in the promise that Typeweaver
can be the reliable source of truth for an API.

## What still matters most

### Onboarding must get dramatically easier

Typeweaver still needs a smoother path from curiosity to first success.

- **`typeweaver init`** should create a clean starting point.
- **Starter templates** should show realistic setups, not just minimal ones.
- **Stronger onboarding** should help new users understand how specs, plugins, and generated output
  fit together.
- An **upgrade / migration guide** should make version-to-version movement feel safe instead of
  expensive.

If adoption is a goal, this work is not optional.

### Validation should be a first-class workflow

**`typeweaver validate`** should exist as its own command and be useful in CI, pre-commit checks,
and fast local feedback loops. "Can I trust this spec?" should be answerable without doing a full
generation step.

### The generated output should scale better

As projects grow, generated code needs clearer boundaries. **Separating generated output by plugin**
would improve navigability, selective regeneration, and general maintainability.

### OpenAPI is still a major strategic lever

**OpenAPI generation** remains one of the highest-value ecosystem moves. Many teams still need an
OpenAPI artifact for documentation, SDK workflows, gateways, or external consumers. If Typeweaver
can stay TypeScript-first while emitting solid OpenAPI, it becomes easier to adopt without forcing a
workflow tradeoff.

## Direction

The roadmap is no longer about rescuing rough edges in a young codebase. It is about turning a
credible foundation into a product that feels obvious to start, safe to upgrade, easy to diagnose,
and pleasant to use every day.
