# 0027. Updated-date provenance

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Metadata
- **Detailed contract:** [metadata-and-analyzer.md §3](../metadata-and-analyzer.md)

## Context
Overview cards show "Updated" dates; build time would mislead.

## Decision
Dates come from authored metadata first, then source history (last commit touching declared source files) when available in the build. Never build time. Absent dates are omitted. Shallow CI clones produce omissions, not guesses.

## Consequences
Builds that want dates need sufficient git history or authored dates.

## Evidence
Pending: M4 analyzer test with shallow and full history.

## Revisit when
Never as a principle; the mechanism may change.