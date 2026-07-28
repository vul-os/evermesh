//! `evermesh-conformance run` — the conformance suite runner (build plan
//! §11).
//!
//! ```text
//! evermesh-conformance run --vectors <dir> [--target kernel|node|relay]
//!                          [--node-harness <path>] [--relay-url <ws url>]
//! ```
//!
//! Executes every vector under `<dir>` (default `tools/conformance/vectors`,
//! resolved relative to this crate's manifest directory when a relative
//! path is given) against the chosen target, prints a per-group
//! pass/fail/skip table, and exits nonzero if anything failed. This is
//! the "golden rule" instrument: the same vectors must pass identically
//! against the kernel crate, `@evermesh/kernel` under Node, and a live
//! relay.
//!
//! Two rules keep a green run meaningful:
//!
//! * **Skips are loud.** Every skipped vector is printed by name with the
//!   reason it was not checked, under a `NOT VERIFIED` heading. A skip is
//!   not a failure, but it is never invisible.
//! * **Coverage is asserted.** The run is checked against the committed
//!   `coverage.json` (see [`evermesh_conformance::coverage`]) and exits
//!   nonzero on any mismatch, so a corpus that shrinks, a group that
//!   disappears, or a target that quietly stops verifying things cannot
//!   report success.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use evermesh_conformance::coverage::Coverage;
use evermesh_conformance::kernel_target::{self, Outcome};
use evermesh_conformance::node_target::{self, NodeHarness};
use evermesh_conformance::relay_target::{self, RelayConn};
use evermesh_conformance::vectors::Vector;
use evermesh_conformance::{default_coverage_path, default_vectors_dir, load_vectors};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Target {
    Kernel,
    Node,
    Relay,
}

impl Target {
    /// The name this target is declared under in `coverage.json`.
    fn name(self) -> &'static str {
        match self {
            Target::Kernel => "kernel",
            Target::Node => "node",
            Target::Relay => "relay",
        }
    }
}

struct Args {
    vectors_dir: PathBuf,
    target: Target,
    node_harness: PathBuf,
    relay_url: String,
    coverage: PathBuf,
}

const USAGE: &str =
    "usage: evermesh-conformance run [--vectors <dir>] [--target kernel|node|relay] \
     [--node-harness <path>] [--relay-url <ws url>] [--coverage <path>]";

fn crate_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn parse_args() -> Result<Args, String> {
    let mut argv = std::env::args().skip(1);
    let sub = argv.next().unwrap_or_default();
    if sub != "run" {
        return Err(format!("{USAGE}\n(got subcommand {sub:?})"));
    }
    let mut vectors_dir = default_vectors_dir();
    let mut target = Target::Kernel;
    let mut node_harness = crate_dir().join("node-harness.mjs");
    let mut relay_url = "ws://127.0.0.1:8787/sync".to_string();
    let mut coverage = default_coverage_path();

    let rest: Vec<String> = argv.collect();
    let mut i = 0;
    while i < rest.len() {
        match rest[i].as_str() {
            "--vectors" => {
                i += 1;
                vectors_dir = PathBuf::from(rest.get(i).ok_or("--vectors needs a value")?);
            }
            "--target" => {
                i += 1;
                target = match rest.get(i).map(String::as_str) {
                    Some("kernel") => Target::Kernel,
                    Some("node") => Target::Node,
                    Some("relay") => Target::Relay,
                    other => {
                        return Err(format!("--target must be kernel|node|relay, got {other:?}"))
                    }
                };
            }
            "--node-harness" => {
                i += 1;
                node_harness = PathBuf::from(rest.get(i).ok_or("--node-harness needs a value")?);
            }
            "--relay-url" => {
                i += 1;
                relay_url = rest.get(i).ok_or("--relay-url needs a value")?.clone();
            }
            "--coverage" => {
                i += 1;
                coverage = PathBuf::from(rest.get(i).ok_or("--coverage needs a value")?);
            }
            other => return Err(format!("unrecognized argument: {other}\n{USAGE}")),
        }
        i += 1;
    }
    Ok(Args {
        vectors_dir,
        target,
        node_harness,
        relay_url,
        coverage,
    })
}

struct GroupTally {
    pass: usize,
    fail: usize,
    skip: usize,
}

fn main() {
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    };

    let coverage = match Coverage::load(&args.coverage) {
        Ok(c) => c,
        Err(e) => {
            eprintln!(
                "failed to load the coverage manifest {}: {e}\nA run without a coverage manifest \
                 cannot tell you how much it verified, so it is not allowed to report success.",
                args.coverage.display()
            );
            std::process::exit(2);
        }
    };

    let vectors = match load_vectors(&args.vectors_dir) {
        Ok(v) => v,
        Err(e) => {
            eprintln!(
                "failed to load vectors from {}: {e}",
                args.vectors_dir.display()
            );
            std::process::exit(2);
        }
    };
    if vectors.is_empty() {
        eprintln!(
            "no vectors found under {} — run `cargo run --bin generate` first",
            args.vectors_dir.display()
        );
        std::process::exit(2);
    }

    let corpus_problems = coverage.check_corpus(&vectors);
    if !corpus_problems.is_empty() {
        print_coverage_problems("corpus", &args.coverage, &corpus_problems);
        std::process::exit(2);
    }

    let results: Vec<(Vector, Outcome)> = match args.target {
        Target::Kernel => run_kernel(&vectors),
        Target::Node => run_node(&vectors, &args.node_harness),
        Target::Relay => run_relay(&vectors, &args.relay_url),
    };

    let any_fail = print_report(&results);
    let target_problems = coverage.check_target(args.target.name(), &results);
    if !target_problems.is_empty() {
        print_coverage_problems(args.target.name(), &args.coverage, &target_problems);
    }
    std::process::exit(if any_fail || !target_problems.is_empty() {
        1
    } else {
        0
    });
}

fn print_coverage_problems(what: &str, manifest: &Path, problems: &[String]) {
    eprintln!("\nCOVERAGE MISMATCH ({what}) — {}", manifest.display());
    for p in problems {
        eprintln!("  {p}");
    }
    eprintln!(
        "\nThis run does not verify what this suite claims to verify. Either restore the missing \
         coverage or update {} in the same commit that changed it.",
        manifest.display()
    );
}

fn run_kernel(vectors: &[Vector]) -> Vec<(Vector, Outcome)> {
    vectors
        .iter()
        .map(|v| (v.clone(), kernel_target::run(v)))
        .collect()
}

fn run_node(vectors: &[Vector], harness_path: &Path) -> Vec<(Vector, Outcome)> {
    let mut harness = match NodeHarness::spawn(harness_path) {
        Ok(h) => h,
        Err(e) => {
            eprintln!(
                "failed to spawn node harness at {} ({e}). Requires Node >= 22.6 and \
                 crates/evermesh-wasm built into packages/kernel-ts/wasm/ (see README).",
                harness_path.display()
            );
            std::process::exit(2);
        }
    };
    vectors
        .iter()
        .map(|v| (v.clone(), node_target::run(&mut harness, v)))
        .collect()
}

fn run_relay(vectors: &[Vector], relay_url: &str) -> Vec<(Vector, Outcome)> {
    let runtime = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
    runtime.block_on(async move {
        let mut conn = match RelayConn::connect(relay_url).await {
            Ok(c) => c,
            Err(e) => {
                eprintln!("failed to connect to relay at {relay_url}: {e}");
                std::process::exit(2);
            }
        };
        if let Err(e) = conn.req_roundtrip("conformance-smoke-test").await {
            eprintln!("REQ/EOSE smoke test failed: {e}");
            std::process::exit(2);
        }
        let mut out = Vec::with_capacity(vectors.len());
        for v in vectors {
            let outcome = relay_target::run(&mut conn, v).await;
            out.push((v.clone(), outcome));
        }
        out
    })
}

/// Print the per-group table, every skip with its reason, and the detail
/// of every failure. Returns whether any vector failed.
fn print_report(results: &[(Vector, Outcome)]) -> bool {
    let mut tally: BTreeMap<String, GroupTally> = BTreeMap::new();
    let mut failures: Vec<(&Vector, &Outcome)> = Vec::new();
    // reason -> the vectors that were not checked for that reason.
    let mut skips: BTreeMap<&str, Vec<String>> = BTreeMap::new();

    for (v, outcome) in results {
        let entry = tally.entry(v.group.clone()).or_insert(GroupTally {
            pass: 0,
            fail: 0,
            skip: 0,
        });
        match outcome {
            Outcome::Pass => entry.pass += 1,
            Outcome::Fail(_) => {
                entry.fail += 1;
                failures.push((v, outcome));
            }
            Outcome::Skip(reason) => {
                entry.skip += 1;
                skips
                    .entry(reason.as_str())
                    .or_default()
                    .push(format!("{}/{}", v.group, v.name));
            }
        }
    }

    let width = tally
        .keys()
        .map(String::len)
        .max()
        .unwrap_or(5)
        .max("GROUP".len());
    println!(
        "{:width$}  {:>6}  {:>6}  {:>6}",
        "GROUP",
        "PASS",
        "FAIL",
        "SKIP",
        width = width
    );
    let mut total_pass = 0;
    let mut total_fail = 0;
    let mut total_skip = 0;
    for (group, t) in &tally {
        println!(
            "{:width$}  {:>6}  {:>6}  {:>6}",
            group,
            t.pass,
            t.fail,
            t.skip,
            width = width
        );
        total_pass += t.pass;
        total_fail += t.fail;
        total_skip += t.skip;
    }
    println!(
        "{:width$}  {:>6}  {:>6}  {:>6}",
        "TOTAL",
        total_pass,
        total_fail,
        total_skip,
        width = width
    );

    // Skips are never silent. A skip is not a failure, but "this vector
    // was not checked" is exactly the information a passing summary line
    // otherwise hides, so every one of them is named here with its
    // reason — grouped by reason, because the reasons repeat and the
    // vectors do not.
    if total_skip > 0 {
        println!("\nNOT VERIFIED — {total_skip} vector(s) skipped, by reason:");
        for (reason, names) in &skips {
            println!("\n  [{}] {reason}", names.len());
            for name in names {
                println!("      {name}");
            }
        }
    }

    if !failures.is_empty() {
        println!("\nFAILURES:");
        for (v, outcome) in &failures {
            let Outcome::Fail(msg) = outcome else {
                unreachable!()
            };
            println!("  {}/{}: {msg}", v.group, v.name);
        }
    }

    total_fail > 0
}
