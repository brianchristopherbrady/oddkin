# Checkbox design decision

This is a Checkbox-local decision under applicable accepted ADRs 0036, 0043 and 0045. Retain the original Checkbox family and state palette, native input, standard form semantics, and shared glyphs. Add local sizing, intrinsic first-line wrapping, and explicit app ownership when needed. [Research comparison](./research.md)

Zag's managed/unmanaged ownership split supports the snapshot design. Preserve independent mixed and checked facts according to HTML. Material Web's native event patterns, Shoelace's default/reset and three sizes, and Spectrum's size examples inform the decision. Their runtime code and framework integrations stay outside Oddkin. [Public contract](./contract.md)
