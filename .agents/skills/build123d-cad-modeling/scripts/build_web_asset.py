#!/usr/bin/env python3
"""Gerador determinístico de fixture CAD para o FinGo BIM Viewer.

Execução:
  uvx --from build123d python build_web_asset.py --config params.json --out-dir ./out
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from build123d import Box, Pos, export_gltf, export_step


def positive(data: dict, key: str) -> float:
    value = float(data[key])
    if value <= 0:
        raise ValueError(f"{key} deve ser maior que zero")
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    data = json.loads(config_path.read_text(encoding="utf-8"))
    name = str(data.get("name") or "fingo-parametric-model").strip().replace(" ", "-")
    width = positive(data, "width_mm")
    depth = positive(data, "depth_mm")
    height = positive(data, "wall_height_mm")
    slab = positive(data, "slab_mm")

    # Fixture intencionalmente simples e determinístico: laje + quatro paredes maciças.
    # Não representa um IFC ou um projeto estrutural.
    floor = Box(width, depth, slab)

    wall_t = min(150.0, width / 20.0, depth / 20.0)
    wall_y = Pos(0, 0, slab) * Box(width, wall_t, height)
    wall_y2 = Pos(0, depth - wall_t, slab) * Box(width, wall_t, height)
    wall_x = Pos(0, wall_t, slab) * Box(wall_t, depth - 2 * wall_t, height)
    wall_x2 = Pos(width - wall_t, wall_t, slab) * Box(wall_t, depth - 2 * wall_t, height)

    model = floor + wall_y + wall_y2 + wall_x + wall_x2
    bbox = model.bounding_box()

    glb_path = out_dir / f"{name}.glb"
    step_path = out_dir / f"{name}.step"
    metadata_path = out_dir / f"{name}.metadata.json"

    export_gltf(model, str(glb_path), binary=True)
    export_step(model, str(step_path))

    metadata = {
        "name": name,
        "unit": "mm",
        "source": "build123d",
        "authoritative_bim": False,
        "bbox_mm": {
            "x": bbox.max.X - bbox.min.X,
            "y": bbox.max.Y - bbox.min.Y,
            "z": bbox.max.Z - bbox.min.Z,
        },
        "volume_mm3": float(model.volume),
        "faces": len(model.faces()),
        "edges": len(model.edges()),
        "files": {
            "glb": str(glb_path),
            "step": str(step_path),
        },
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(json.dumps({**metadata, "metadata": str(metadata_path)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
