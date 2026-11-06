# Fix invalid S-06-R one-off GitHub Actions YAML — 2026-11-06

After initial S-06-R failed on test-only 404-vs-503 expectation, PR #227 tried the narrow retry; GitHub Actions rejected its Workflow **before any job** due duplicated malformed YAML. This PR replaces complete YAML with a single valid job and changes only the already-failed S-06-R spec comment to activate it. Guard checks exactly one MODIFIED existing spec and its marker, with same-SHA guarded Preview. No prior passed Master spec rerun. Five other Master 021 cases remain blocked.

No app, finance, HR or SQL data changes. Require CI 12/12, verified same-SHA preview, one protected Chromium 1/1, unchanged SQL counters before recording case S-06-R bounded negative authorization PASS.
