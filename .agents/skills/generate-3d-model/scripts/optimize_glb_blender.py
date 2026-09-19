"""Otimização determinística de GLB para Blender headless.

Uso:
  blender -b -P optimize_glb_blender.py -- input.glb output.glb 75000

O script preserva transforms e só aplica decimate quando o total de triângulos
excede o alvo. Não altera escala/unidade deliberadamente.
"""
from __future__ import annotations

import sys
from pathlib import Path

import bpy


def cli_args() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1:]


def triangle_count(obj) -> int:
    if obj.type != "MESH":
        return 0
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def main() -> int:
    args = cli_args()
    if len(args) != 3:
        raise SystemExit("uso: blender -b -P optimize_glb_blender.py -- input.glb output.glb target_triangles")

    src = Path(args[0]).resolve()
    dst = Path(args[1]).resolve()
    target = max(1, int(args[2]))

    if not src.exists():
        raise SystemExit(f"arquivo não encontrado: {src}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(src))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    before = sum(triangle_count(obj) for obj in meshes)
    if before <= 0:
        raise SystemExit("GLB sem malhas trianguláveis")

    if before > target:
        ratio = max(0.01, min(1.0, target / before))
        for obj in meshes:
            if triangle_count(obj) == 0:
                continue
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            modifier = obj.modifiers.new(name="FinGoWebDecimate", type="DECIMATE")
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj.select_set(False)

    # Limpeza conservadora: remove somente datablocks órfãos.
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)

    dst.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(dst),
        export_format="GLB",
        export_apply=True,
    )

    after = sum(triangle_count(obj) for obj in meshes)
    print(f"triangles_before={before}")
    print(f"triangles_after={after}")
    print(f"output={dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
