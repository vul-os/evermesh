//! The Evermesh conformance suite (build plan §11): a shared vector
//! format plus per-target execution logic, used by both the vector
//! generator (`src/bin/generate.rs`) and the runner (`src/main.rs`).
//!
//! This crate is deliberately thin: all protocol behavior comes from
//! `evermesh-kernel`. What lives here is the vector format itself
//! ([`vectors`]) and the three ways to replay a vector set against a
//! runtime ([`kernel_target`], [`node_target`], [`relay_target`]).

pub mod coverage;
pub mod kernel_target;
pub mod node_target;
pub mod relay_target;
pub mod vectors;

/// Load every `*.json` vector file under `dir`, recursively, sorted by
/// path for deterministic iteration order.
///
/// A file that is present but unreadable or unparseable is an **error**,
/// never a skipped file. Dropping it with a warning would shrink the
/// corpus silently — the exact failure mode [`coverage`] exists to make
/// impossible — so a malformed fixture stops the run instead of quietly
/// reducing what gets verified.
pub fn load_vectors(dir: &std::path::Path) -> std::io::Result<Vec<vectors::Vector>> {
    let mut paths = Vec::new();
    collect_json_paths(dir, &mut paths)?;
    paths.sort();
    let mut out = Vec::with_capacity(paths.len());
    for path in paths {
        let text = std::fs::read_to_string(&path)?;
        let vector = serde_json::from_str::<vectors::Vector>(&text).map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("failed to parse vector {}: {e}", path.display()),
            )
        })?;
        out.push(vector);
    }
    Ok(out)
}

/// The vector directory shipped with this crate
/// (`tools/conformance/vectors`), resolved absolutely so a caller's
/// working directory never matters.
pub fn default_vectors_dir() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("vectors")
}

/// The committed coverage manifest shipped with this crate
/// (`tools/conformance/coverage.json`).
pub fn default_coverage_path() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("coverage.json")
}

fn collect_json_paths(
    dir: &std::path::Path,
    out: &mut Vec<std::path::PathBuf>,
) -> std::io::Result<()> {
    if !dir.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("{} is not a directory", dir.display()),
        ));
    }
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_json_paths(&path, out)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("json") {
            out.push(path);
        }
    }
    Ok(())
}
