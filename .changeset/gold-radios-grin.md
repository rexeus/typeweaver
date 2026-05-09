---
"@rexeus/typeweaver-gen": patch
---

Harden generator plugin file writes so unsafe paths cannot escape the configured output directory.

Generated plugin writes and manually tracked files now reject traversal, absolute, Windows drive/rooted/UNC, symlink, directory-like, and output-root paths. Existing generated files are replaced through a temporary file and rename so hardlinked files outside the output directory are not mutated.
