# Composite roles

One composite template renders two families of children (`demo-*` and `studio-*`): each composite lists its children as `dependencies`, and the template writes them through `rolesOf(host)` and `composite` from `@oddkin/core/template/roles` ([ADR 0043](../../docs/architecture/decisions/0043-composite-dependency-mechanism.md)). The page runs under a strict Content Security Policy with Trusted Types required; only validated custom element names reach the `oddkin-template` policy.

```sh
npm run build
node scripts/serve-static.mjs   # then open http://localhost:4173/examples/composite-roles/
```

Checked by `e2e/composite-roles.spec.ts` in Chromium, Firefox, and WebKit. After editing the import map, run `node scripts/update-csp-hash.mjs examples/composite-roles/index.html`.
