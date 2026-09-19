#!/usr/bin/env python3
"""Validador mínimo e determinístico de GLB para assets do FinGo."""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

MAX_BYTES = 15 * 1024 * 1024


def validate(path: Path) -> dict:
    if not path.exists() or not path.is_file():
        raise ValueError("arquivo não encontrado")
    size = path.stat().st_size
    if size <= 20:
        raise ValueError("arquivo GLB pequeno demais")
    if size > MAX_BYTES:
        raise ValueError("arquivo excede 15 MB")

    with path.open("rb") as fh:
        header = fh.read(12)

    magic, version, declared_length = struct.unpack("<4sII", header)
    if magic != b"glTF":
        raise ValueError("magic bytes GLB inválidos")
    if version != 2:
        raise ValueError(f"versão GLB não suportada: {version}")
    if declared_length != size:
        raise ValueError(f"tamanho declarado {declared_length} difere do arquivo {size}")

    return {
        "valid": True,
        "path": str(path.resolve()),
        "bytes": size,
        "megabytes": round(size / 1024 / 1024, 3),
        "glb_version": version,
        "authoritative_bim": False,
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("uso: validate_glb.py /caminho/model.glb", file=sys.stderr)
        return 2
    try:
        result = validate(Path(sys.argv[1]))
        print(json.dumps(result))
        return 0
    except Exception as exc:
        print(json.dumps({"valid": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
