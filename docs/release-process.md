# Release process (stub)

Status: **stub**. Nothing is published, and every package is `private: true`. Publishing and deployment are separately authorized actions (plan M12).

Before the first release:

- [ ] Choose a licence and add `LICENSE`; set `license` in every manifest.
- [ ] Confirm ownership of the `@oddkin` npm scope; remove `private: true` from publishable packages.
- [ ] Decide independent versioning tooling and changelog format (per-package changelogs).
- [ ] Define compatibility, deprecation, and upgrade policies, including metadata schema versioning (ADR 0029).
- [ ] Run `npm run verify` and the full M12 release matrix; record results in [verification.md](./verification.md).
- [ ] Run `oddkin analyze --compare` against the previous release once the analyzer exists, and review semver impact.