# Upstream fixture provenance

Source: https://github.com/antfu/eslint-config
Version: 10.0.0
Commit: bb2013690a517ea9b369d36d79a5708356326a64
Retrieved: 2026-11-16

`input/` is an unmodified copy of `fixtures/input/`.
`expected/` is an unmodified copy of `fixtures/output/all/`.
If no expected file exists, Antfu's fixture runner expects the input to remain unchanged.
The upstream MIT license is preserved in `LICENSE`.

Do not format or lint these source fixtures as package code. The comparison runner copies them
into a temporary consumer before invoking Oxlint and Oxfmt. Native limitations and observed
results are documented in `docs/antfu-compatibility.md` at the repository root.
