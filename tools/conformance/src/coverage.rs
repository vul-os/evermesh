//! The coverage manifest: what this suite is *supposed* to verify.
//!
//! A conformance harness that reports "0 failures" tells you nothing on
//! its own — it says the same thing when it ran 189 vectors and when it
//! ran none, or when half the corpus quietly turned into skips. This
//! module is the answer to that: `tools/conformance/coverage.json`
//! declares, per vector group and per runner target, the **exact**
//! pass/fail/skip shape a green run must have, and every run checks
//! itself against it.
//!
//! Consequences, all deliberate:
//!
//! * Adding a vector fails the run until `coverage.json` is updated. That
//!   is the point — a growing corpus cannot silently under-run, and the
//!   diff that adds a vector also shows what it changed about coverage.
//! * Deleting or renaming a group fails the run.
//! * A vector that flips from checked to skipped fails the run, even
//!   though a skip is not a failure, because the total that *was*
//!   verified went down.
//! * A target whose harness dies early and checks nothing cannot pass:
//!   zero results is a coverage mismatch, not an empty success.
//!
//! The manifest is **hand-maintained on purpose**. Regenerating it from
//! whatever the code happens to do would make it a mirror rather than a
//! claim, and a mirror cannot catch drift.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::kernel_target::Outcome;
use crate::vectors::Vector;

/// Expected pass/fail/skip counts for one runner target.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TargetExpectation {
    pub pass: usize,
    pub fail: usize,
    pub skip: usize,
}

impl TargetExpectation {
    fn total(&self) -> usize {
        self.pass + self.fail + self.skip
    }
}

/// The whole `coverage.json` document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Coverage {
    /// Why this file exists, carried in the file itself so nobody
    /// "fixes" a coverage failure by deleting the manifest.
    pub note: String,
    /// Total vector count across every group.
    pub total: usize,
    /// `<group>` -> number of vector files in `vectors/<group>/`.
    pub groups: BTreeMap<String, usize>,
    /// `<target>` -> the exact outcome shape a green run must produce.
    pub targets: BTreeMap<String, TargetExpectation>,
}

impl Coverage {
    /// Read the manifest from `path`.
    pub fn load(path: &Path) -> std::io::Result<Coverage> {
        let text = std::fs::read_to_string(path)?;
        serde_json::from_str(&text).map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("failed to parse coverage manifest {}: {e}", path.display()),
            )
        })
    }

    /// Check the loaded corpus against the manifest's per-group counts.
    ///
    /// Returns every discrepancy, not just the first, so one run tells
    /// you everything that has to change.
    pub fn check_corpus(&self, vectors: &[Vector]) -> Vec<String> {
        let mut actual: BTreeMap<&str, usize> = BTreeMap::new();
        for v in vectors {
            *actual.entry(v.group.as_str()).or_insert(0) += 1;
        }

        let mut problems = Vec::new();
        for (group, want) in &self.groups {
            match actual.get(group.as_str()) {
                Some(got) if got == want => {}
                Some(got) => problems.push(format!(
                    "group {group}: corpus has {got} vector(s), coverage.json declares {want}"
                )),
                None => problems.push(format!(
                    "group {group}: declared in coverage.json ({want} vector(s)) but absent from \
                     the corpus"
                )),
            }
        }
        for (group, got) in &actual {
            if !self.groups.contains_key(*group) {
                problems.push(format!(
                    "group {group}: {got} vector(s) in the corpus but undeclared in coverage.json \
                     — add it, so a new group is a reviewed change and not an invisible one"
                ));
            }
        }
        if vectors.len() != self.total {
            problems.push(format!(
                "total: corpus has {} vector(s), coverage.json declares {}",
                vectors.len(),
                self.total
            ));
        }
        problems
    }

    /// Check one target's observed outcomes against the manifest.
    ///
    /// An unknown target name is itself a discrepancy: a target with no
    /// declared expectation would otherwise be able to verify nothing at
    /// all and still exit zero.
    pub fn check_target(&self, target: &str, results: &[(Vector, Outcome)]) -> Vec<String> {
        let Some(want) = self.targets.get(target) else {
            return vec![format!(
                "target {target}: no expectation in coverage.json — every target must declare \
                 what a green run looks like"
            )];
        };

        let mut got = TargetExpectation {
            pass: 0,
            fail: 0,
            skip: 0,
        };
        for (_, outcome) in results {
            match outcome {
                Outcome::Pass => got.pass += 1,
                Outcome::Fail(_) => got.fail += 1,
                Outcome::Skip(_) => got.skip += 1,
            }
        }

        let mut problems = Vec::new();
        if got.total() != want.total() {
            problems.push(format!(
                "target {target}: ran {} vector(s), coverage.json declares {}",
                got.total(),
                want.total()
            ));
        }
        if got.pass != want.pass {
            problems.push(format!(
                "target {target}: {} passed, coverage.json declares {} — {}",
                got.pass,
                want.pass,
                if got.pass < want.pass {
                    "fewer vectors were verified than this suite claims to verify"
                } else {
                    "more vectors passed than declared; update coverage.json in the same commit"
                }
            ));
        }
        if got.skip != want.skip {
            problems.push(format!(
                "target {target}: {} skipped, coverage.json declares {} — a change in what this \
                 target declines to check is a coverage change, not a detail",
                got.skip, want.skip
            ));
        }
        if got.fail != want.fail {
            problems.push(format!(
                "target {target}: {} failed, coverage.json declares {}",
                got.fail, want.fail
            ));
        }
        problems
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vectors::{Vector, VectorData};

    fn manifest() -> Coverage {
        Coverage {
            note: "test".into(),
            total: 2,
            groups: BTreeMap::from([("a".to_string(), 1), ("b".to_string(), 1)]),
            targets: BTreeMap::from([(
                "kernel".to_string(),
                TargetExpectation {
                    pass: 2,
                    fail: 0,
                    skip: 0,
                },
            )]),
        }
    }

    fn vector(group: &str, name: &str) -> Vector {
        Vector {
            group: group.to_string(),
            name: name.to_string(),
            description: "fixture".into(),
            data: VectorData::JsonRoundtrip {
                json: "{}".into(),
                expected_cbor_hex: None,
                expected_error: Some("cbor".into()),
            },
        }
    }

    #[test]
    fn matching_corpus_has_no_problems() {
        let vs = vec![vector("a", "one"), vector("b", "one")];
        assert!(manifest().check_corpus(&vs).is_empty());
    }

    #[test]
    fn a_shrinking_corpus_is_reported() {
        let vs = vec![vector("a", "one")];
        let problems = manifest().check_corpus(&vs);
        assert!(
            problems.iter().any(|p| p.contains("group b")),
            "a vanished group must be named: {problems:?}"
        );
        assert!(
            problems.iter().any(|p| p.starts_with("total:")),
            "the total must be reported too: {problems:?}"
        );
    }

    #[test]
    fn an_undeclared_group_is_reported() {
        let vs = vec![vector("a", "one"), vector("b", "one"), vector("c", "one")];
        let problems = manifest().check_corpus(&vs);
        assert!(
            problems.iter().any(|p| p.contains("group c")),
            "a new group must be named: {problems:?}"
        );
    }

    #[test]
    fn an_empty_run_cannot_pass_the_target_check() {
        let problems = manifest().check_target("kernel", &[]);
        assert!(
            !problems.is_empty(),
            "a target that verified nothing must not look green"
        );
    }

    #[test]
    fn a_pass_turning_into_a_skip_is_reported() {
        let results = vec![
            (vector("a", "one"), Outcome::Pass),
            (vector("b", "one"), Outcome::Skip("no surface".into())),
        ];
        let problems = manifest().check_target("kernel", &results);
        assert!(
            problems.iter().any(|p| p.contains("passed")),
            "a lost pass must be reported: {problems:?}"
        );
        assert!(
            problems.iter().any(|p| p.contains("skipped")),
            "a new skip must be reported: {problems:?}"
        );
    }

    #[test]
    fn an_undeclared_target_cannot_pass() {
        let results = vec![(vector("a", "one"), Outcome::Pass)];
        let problems = manifest().check_target("relay", &results);
        assert_eq!(problems.len(), 1);
        assert!(problems[0].contains("no expectation"));
    }

    #[test]
    fn the_shipped_manifest_parses_and_is_self_consistent() {
        let cov = Coverage::load(&crate::default_coverage_path())
            .expect("tools/conformance/coverage.json must parse");
        let summed: usize = cov.groups.values().sum();
        assert_eq!(
            summed, cov.total,
            "coverage.json's per-group counts must sum to its declared total"
        );
        assert!(
            cov.targets.contains_key("kernel"),
            "the reference target must always declare an expectation"
        );
        for (name, t) in &cov.targets {
            assert_eq!(
                t.total(),
                cov.total,
                "target {name} must account for every vector: a target that silently ignores \
                 part of the corpus is the thing this manifest exists to prevent"
            );
            assert_eq!(t.fail, 0, "target {name} must declare zero failures");
        }
    }
}
