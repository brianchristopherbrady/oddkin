# Button v2 design and implementation record

Agent 1 item 11 · C:/SLT_Backup_10-21-2026/oddkin-a1-main · baseline `e84a08e33ee5510cb86dc462ccbf9e3a7fcce7dd`.

[Specification](../../specifications/odd-button/spec.md) · [Handoff](../../specifications/odd-button/handoff.json) · [Run](./run.json) · [Figma](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Oddkin---Design-Framework?node-id=1398-2)

The refreshed post-build comparison pairs six specimens across both themes. Inspect the [side overview](./evidence/odd-button-v2/comparison/_sheet-side.png), [overlay](./evidence/odd-button-v2/comparison/_sheet-overlay.png), [difference overview](./evidence/odd-button-v2/comparison/_sheet-diff.png) and [fidelity review](./evidence/odd-button-v2/verification.md). The comparison records the Figma frames, live URLs, exact build file hashes and observed discrepancies. For a fresh bench open the bundled `evidence` directory as its asset root, then use the specimen URL in the implementation report.

- Chromium reported 339 passes with all cases run. [Test report](./evidence/browser/chromium.json)
- Firefox reported 317 passes and 22 skips. [Test report](./evidence/browser/firefox.json)
- WebKit reported 335 passes and four skips. [Test report](./evidence/browser/webkit.json)

The [v1 archive](./v1-specification-archive.json) preserves the previous design decision and contract text. Existing component metadata and package kit generation are checked through the lane build.

The [native spec readback](../../specifications/odd-button/figma-native-spec.md) preserves the Figma document text. The [structural audit](../../specifications/odd-button/figma-evidence.json) records the 127 variants, 24 prototype edges, zero overlaps, and focus fixture clearances.
