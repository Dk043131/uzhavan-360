"""Create and verify a secret-free source archive without changing application code."""
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import os

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend/public/downloads/uzhavan-360-project.zip"
SKIP_DIRS = {
    "node_modules", ".git", ".emergent", ".venv", "venv", "env",
    "__pycache__", ".pytest_cache", ".ruff_cache", ".cache", "build", "dist",
    "coverage", "downloads", "test_reports", "logs", ".idea", ".vscode",
}
SKIP_FILES = {"test_credentials.md", "test_result.md", ".DS_Store", ".npmrc", ".yarnrc"}
SKIP_SUFFIXES = {".pyc", ".log", ".zip", ".pem", ".key", ".p12", ".pfx", ".db", ".sqlite"}
TREES = ("frontend", "uzhavan-backend", "backend", "tests", "scripts")
DOCUMENTS = ("README.md", "SETUP.md", "design_guidelines.json", "memory/PRD.md", ".gitignore")


def allowed(path):
    return (
        not path.is_symlink()
        and path.name not in SKIP_FILES
        and path.suffix not in SKIP_SUFFIXES
        and (not path.name.startswith(".env") or path.name == ".env.example")
    )


def source_files():
    files = []
    for folder in TREES:
        for directory, subdirs, names in os.walk(ROOT / folder):
            subdirs[:] = [d for d in subdirs if d not in SKIP_DIRS and not (Path(directory) / d).is_symlink()]
            files.extend(Path(directory) / name for name in names if allowed(Path(directory) / name))
    files.extend(ROOT / name for name in DOCUMENTS if (ROOT / name).is_file())
    return sorted(set(files))


def local_secrets():
    """Check current backend secret values are not embedded in exported source."""
    values = []
    for filename in ("backend/.env", "uzhavan-backend/server/.env", "frontend/.env", "frontend/.env.local"):
        path = ROOT / filename
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            if line.lstrip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip().strip("\"'")
            if any(word in key.upper() for word in ("SECRET", "PASSWORD", "TOKEN", "API_KEY")) and len(value) >= 12:
                values.append(value.encode())
    return values


def main():
    files = source_files()
    secrets = local_secrets()
    contents = {}
    for path in files:
        data = path.read_bytes()
        if any(secret in data for secret in secrets):
            raise RuntimeError(f"Private environment value found in {path.relative_to(ROOT)}; export aborted")
        contents["uzhavan-360/" + path.relative_to(ROOT).as_posix()] = data

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".zip.tmp")
    with ZipFile(temporary, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in contents.items():
            archive.writestr(name, data)

    with ZipFile(temporary) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("Archive CRC verification failed")
        assert set(archive.namelist()) == set(contents), "Archive file list mismatch"
        for name, data in contents.items():
            assert sha256(archive.read(name)).digest() == sha256(data).digest(), name
        for template in ("frontend/.env.example", "backend/.env.example", "uzhavan-backend/server/.env.example"):
            assert "uzhavan-360/" + template in archive.namelist(), template
        assert not any(Path(name).name.startswith(".env") and not name.endswith(".env.example") for name in archive.namelist())

    temporary.replace(OUTPUT)
    digest = sha256(OUTPUT.read_bytes()).hexdigest()
    OUTPUT.with_suffix(".zip.sha256").write_text(f"{digest}  {OUTPUT.name}\n")
    print(f"Created: {OUTPUT}")
    print(f"Files: {len(contents)}; size: {OUTPUT.stat().st_size:,} bytes")
    print("Verified: ZIP CRC, per-file SHA-256, required templates, private environment exclusion")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    main()