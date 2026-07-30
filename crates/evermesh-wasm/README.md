# evermesh-wasm

wasm-bindgen bindings over `evermesh-kernel`, built with wasm-pack and consumed
by `packages/kernel-ts`. One crypto implementation everywhere: the same Rust
code verifies records natively, in Node, and in the browser.

**Status: implemented.** `src/lib.rs` exports the full surface
`packages/kernel-ts` consumes — record build/verify/id, identity
genesis/rotation/chain verification, kind validation, JSON round-trip,
blob hashing/chunk-tree verification, and derivation signing — over
`wasm-bindgen`. This previously read "Phase 0 scaffold — no
implementation yet"; that was true when written but is stale now that
Phase 3 has landed, so it is corrected here rather than left to imply
the crate is still empty.

## Build

```sh
just wasm   # wasm-pack build into packages/kernel-ts/wasm/
```
