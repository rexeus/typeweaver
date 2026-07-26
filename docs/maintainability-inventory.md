# Maintainability lint inventory

The Oxlint maintainability gate was introduced on 2026-07-25 with the exact project thresholds from
`.oxlintrc.json`. The first full lint run reported 203 violations:

| Rule                            | Initial violations |
| ------------------------------- | -----------------: |
| `eslint/max-lines-per-function` |                133 |
| `eslint/complexity`             |                 29 |
| `eslint/max-nested-callbacks`   |                 18 |
| `eslint/max-params`             |                  9 |
| `sonarjs/cognitive-complexity`  |                  8 |
| `eslint/max-statements`         |                  4 |
| `sonarjs/expression-complexity` |                  2 |
| `eslint/max-depth`              |                  0 |
| `sonarjs/no-nested-switch`      |                  0 |

Of these findings, 144 were in tests, 55 were in package source code, and 4 were in repository
tooling. This inventory records the starting point only. It is not a suppression baseline: the
enforced target is zero violations.

Oxlint provides the six compatibility-namespaced rules natively. The three `sonarjs/*` rules are
loaded through Oxlint's JavaScript plugin support. Automatic pnpm peer installation is disabled so
that the SonarJS plugin cannot pull in its optional legacy linter peer; that separate linter is
neither declared nor installed.
