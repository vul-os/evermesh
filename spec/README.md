# Vidmesh specification

The Vidmesh protocol specification, licensed CC-BY-SA-4.0 (see
`../LICENSE-SPEC`).

## Contents

- `draft-vidmesh-protocol-00.md` — **Draft 0.2**, the current
  specification: an RFC-style document covering the kernel, identity,
  registries, content/claims layers, relays, bundles, privacy, economics,
  gateways, and governance. Supersedes the Draft 0.1 proposal
  (`../VIDMESH_SPEC_PROPOSAL.md`); changes are listed in its Appendix B.
- `pandoc-pdf.yaml` — pandoc defaults for the PDF rendering.

## Building the PDF

```sh
just spec-pdf   # requires pandoc and tectonic; writes dist/vidmesh-protocol-draft-00.pdf
```

The output is a classic technical-report PDF: Latin Modern type, numbered
sections, hyperlinked table of contents, color only in code highlighting.

## Roadmap

Phase 1 of the build plan splits and deepens this document into the
numbered per-concern files (`000-overview.md` … `011-threat-model.md`),
adding full body schemas, worked examples, and per-file test-vector
indexes.
