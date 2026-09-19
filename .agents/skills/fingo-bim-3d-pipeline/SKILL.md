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

## Definition of done

- asset válido;
- <= 15 MB;
- metadata de unidade/origem presente;
- histórico de versão preservado;
- testes do BIM verdes;
- preview Vercel READY;
- Security Regression e Cloudflare build verdes;
- nenhuma alteração de produção sem aprovação.
