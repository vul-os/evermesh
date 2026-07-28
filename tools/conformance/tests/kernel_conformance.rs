//! The conformance suite as a **test**, not only as a CLI.
//!
//! `evermesh-conformance run --target kernel` is the instrument a human
//! runs; this file is the same thing wired into `cargo test --workspace`,
//! so the reference target is exercised by the ordinary CI gate rather
//! than only when somebody remembers to invoke the binary. The `node` and
//! `relay` targets need a built WASM package and a running relay
//! respectively, so they stay CLI-driven and are invoked explicitly by
//! their own CI jobs (see `.github/workflows/ci.yml`).
//!
//! These tests fail loudly on an *under-run*, not just on a wrong answer:
//! the corpus must match the committed coverage manifest exactly, and the
//! kernel target must check every vector in it.

use evermesh_conformance::coverage::Coverage;
use evermesh_conformance::kernel_target::{self, Outcome};
use evermesh_conformance::vectors::Vector;
use evermesh_conformance::{default_coverage_path, default_vectors_dir, load_vectors};

fn corpus() -> Vec<Vector> {
    load_vectors(&default_vectors_dir()).unwrap_or_else(|e| {
        panic!(
            "the conformance corpus at {} must load: {e}",
            default_vectors_dir().display()
        )
    })
}

fn manifest() -> Coverage {
    Coverage::load(&default_coverage_path()).expect("tools/conformance/coverage.json must load")
}

#[test]
fn corpus_matches_the_committed_coverage_manifest() {
    let problems = manifest().check_corpus(&corpus());
    assert!(
        problems.is_empty(),
        "the corpus no longer matches coverage.json:\n  {}",
        problems.join("\n  ")
    );
}

#[test]
fn kernel_target_passes_every_vector_and_skips_none() {
    let vectors = corpus();
    assert!(
        !vectors.is_empty(),
        "an empty corpus must never look like a passing run"
    );

    let results: Vec<(Vector, Outcome)> = vectors
        .into_iter()
        .map(|v| {
            let outcome = kernel_target::run(&v);
            (v, outcome)
        })
        .collect();

    let failures: Vec<String> = results
        .iter()
        .filter_map(|(v, o)| match o {
            Outcome::Fail(msg) => Some(format!("{}/{}: {msg}", v.group, v.name)),
            _ => None,
        })
        .collect();
    assert!(
        failures.is_empty(),
        "kernel target failures:\n  {}",
        failures.join("\n  ")
    );

    // The reference target is the one target with nothing to decline:
    // it is the kernel the vectors were written against. Any skip here
    // means the suite quietly stopped checking something.
    let skipped: Vec<String> = results
        .iter()
        .filter_map(|(v, o)| match o {
            Outcome::Skip(reason) => Some(format!("{}/{}: {reason}", v.group, v.name)),
            _ => None,
        })
        .collect();
    assert!(
        skipped.is_empty(),
        "the kernel target must check every vector; these were NOT verified:\n  {}",
        skipped.join("\n  ")
    );

    let problems = manifest().check_target("kernel", &results);
    assert!(
        problems.is_empty(),
        "kernel target coverage mismatch:\n  {}",
        problems.join("\n  ")
    );
}

/// A vector file that is present but unparseable must stop the run.
/// Before this was enforced the loader warned and dropped it, which
/// meant a corrupt fixture shrank the corpus without failing anything.
#[test]
fn an_unparseable_vector_file_fails_the_load() {
    let dir = std::env::temp_dir().join(format!(
        "evermesh-conformance-badvec-{}-{}",
        std::process::id(),
        line!()
    ));
    std::fs::create_dir_all(&dir).expect("temp dir");
    std::fs::write(dir.join("broken.json"), b"{ not json ").expect("write fixture");

    let err = load_vectors(&dir).expect_err("a malformed vector must be an error, not a warning");
    assert!(
        err.to_string().contains("broken.json"),
        "the error must name the offending file, got: {err}"
    );

    std::fs::remove_dir_all(&dir).ok();
}

/// An absent vector directory is an error too: "no files found" and
/// "nothing to check" must never be reported as a clean run.
#[test]
fn a_missing_vector_directory_fails_the_load() {
    let missing = std::env::temp_dir().join("evermesh-conformance-does-not-exist-xyzzy");
    assert!(load_vectors(&missing).is_err());
}
