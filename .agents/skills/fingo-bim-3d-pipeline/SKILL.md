---
name: fingo-bim-3d-pipeline
description: >
  Orquestra tarefas 3D/BIM do FinGo escolhendo entre arquivo BIM real, build123d
  paramétrico, geração visual por imagem e otimização Blender/Python. Acione para
  importação, exportação web, criação de fixtures, versionamento, propriedades,
  coordenação, cortes, performance ou preparação para clash detection.
risk: safe
source: project
---

# FinGo BIM 3D Pipeline

## When to use

Use esta skill como porta de entrada para qualquer alteração relevante do BIM Viewer.

Antes de codificar, classifique a fonte:

| Fonte | Pipeline |
| --- | --- |
| IFC/OBJ/GLTF/GLB real | preservar arquivo e importar diretamente |
| Geometria paramétrica conhecida | ler `build123d-cad-modeling` |
| Imagem 2D sem CAD original | ler `generate-3d-model` após autorização |
| Asset pesado | otimização Blender/Python/glTF Transform |
| Clash detection | somente após geometria real tessellada e coordenadas confiáveis |

## Constraints

- Não simular clash detection sobre bounding boxes procedurais como se fosse resultado BIM real.
- Não converter asset gerado por IA em modelo autoritativo.
- Não ultrapassar 15 MB por upload atual.
- Meta de até 150k triângulos por modelo; preferir 75k ou menos para mobile.
- Texturas <= 2048x2048.
- Preservar escala, eixo e unidade em metadata.
- Todo modelo novo é uma nova versão; não sobrescrever silenciosamente a versão anterior.
- IFC original deve ser mantido mesmo que exista uma versão GLB derivada.
- Toda transformação deve registrar origem, ferramenta, parâmetros e hash quando disponível.
- Booleanas IFC só podem ser marcadas como exatas quando o motor determinístico realmente produzir a malha resultante.
- `IfcRelVoidsElement`, `IfcBooleanResult`, `IfcBooleanClippingResult` e half-spaces suportados devem preservar o guardrail de `clashEligible`; fallback parcial nunca é autoritativo.
- O motor BSP/CSG do viewer limita cada operação a 12.000 triângulos de entrada e 50.000 de saída; acima disso, preservar o modelo e marcar a operação como parcial em vez de travar o navegador.
- A cadeia IFC atualmente prioriza SweptSolid, SweptDiskSolid, MappedItem, FacetedBrep, TessellatedFaceSet, openings e half-spaces planares/poligonais suportados.
- Curvas IFC suportadas deterministicamente incluem Polyline, IndexedPolyCurve com LineIndex/ArcIndex, CompositeCurve, TrimmedCurve sobre Circle/Ellipse, IfcBSplineCurveWithKnots e IfcRationalBSplineCurveWithKnots; segmentos desconhecidos devem marcar o elemento como parcial.
- B-Spline/NURBS devem preservar grau, vetor de nós, multiplicidades e pesos; vetor de nós inválido ou pesos inconsistentes tornam a curva parcial.
- O renderer pode usar culling e LOD apenas para exibição/interação; a malha autoritativa armazenada e usada no clash nunca deve ser destrutivamente reduzida.
- IfcIndexedPolygonalFaceWithVoids só pode permanecer autoritativo quando a decomposição planar preservar exatamente o contorno externo e os vazios.

## Workflow

1. Identificar fonte e autoridade do modelo.
2. Validar localmente formato e tamanho.
3. Para CAD paramétrico, seguir `build123d-cad-modeling`.
4. Para imagem 2D, seguir `generate-3d-model`.
5. Produzir GLB para a web e preservar fonte original.
6. Validar GLB.
7. Conferir orçamento de polígonos/texturas.
8. Abrir em preview e validar escala/orientação.
9. Versionar em Documentos da obra.
10. Só então habilitar propriedades, filtros, cortes e coordenação.
11. Clash detection só entra depois que elementos reais tiverem geometria e sistema de coordenadas comparável.
12. Antes do clash, confirmar que booleanas/openings do elemento estão `clashEligible !== false`; elementos parciais ficam fora da análise autoritativa.

## Definition of done

- asset válido;
- <= 15 MB;
- metadata de unidade/origem presente;
- histórico de versão preservado;
- testes do BIM verdes;
- preview Vercel READY;
- Security Regression e Cloudflare build verdes;
- nenhuma alteração de produção sem aprovação.
