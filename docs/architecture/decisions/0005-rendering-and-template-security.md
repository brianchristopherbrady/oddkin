# 0005. Tagged-template rendering and security model

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Core
- **Detailed contract:** [core-contracts.md §6](../core-contracts.md)

## Context
Rendering must preserve DOM identity, avoid a virtual DOM or compiler, and be safe under strict CSP and Trusted Types.

## Decision
- Tagged `html` templates → cached static `<template>` + binding parts (text, attribute, `?bool`, `.prop`, `@event`, nested templates, readables); `when`, keyed `repeat`, `match`.
- No `eval`; no implicit string-to-HTML; dynamic values become text by default; static template markup parsed through an explicit CSP/Trusted Types-compatible path.
- Unsafe sinks and URL policy defined; any trusted-markup escape hatch is a separate explicit API.

## Alternatives considered
- Virtual DOM — extra allocation and identity issues.
- Compiler-only templates — conflicts with no-build authoring.

## Consequences
Template parsing must have a Trusted Types policy path; tests run under strict CSP.

## Evidence
R01, R24. BCD 8.1.6: Trusted Types Chrome/Edge 83, Firefox 148, Safari 26 — integration is enforced only where supported. Pending: M3 CSP/Trusted Types tests.

## Revisit when
A browser in the baseline cannot parse templates under the chosen CSP without unsafe-inline.