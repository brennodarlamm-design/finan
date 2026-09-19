---
name: build123d-cad-modeling
description: >
  Geração determinística de geometria CAD paramétrica para o FinGo BIM Viewer usando
  build123d/Python. Acione ao criar sólidos, peças, volumes arquitetônicos simplificados,
  fixtures de teste, operações booleanas ou exportações GLB/STEP/STL. Não use como parser
  IFC semântico, fonte de quantitativos oficiais ou substituto de projeto estrutural.
risk: safe
source: adapted
---

# build123d CAD Modeling — FinGo

## When to use

Leia esta skill quando a tarefa envolver qualquer um destes pontos:

- criar geometria 3D paramétrica por código;
- gerar massa arquitetônica, componentes, peças ou fixtures para testes do BIM Viewer;
- usar booleanas, extrusão, loft, sweep, shell, fillet ou chamfer;
- exportar geometria para GLB para visualização web;
- exportar STEP para intercâmbio CAD ou STL para prototipagem;
- inspecionar bounding box, volume, faces e arestas antes de publicar um asset;
- produzir um modelo determinístico quando uma imagem 2D não deve ser enviada para IA externa.

Não acione esta skill para importar IFC real, extrair propriedades IFC, calcular quantitativos oficiais, executar clash detection de engenharia ou validar projeto estrutural.

## Constraints

1. **Formato web preferido:** GLB binário.
2. **Limite duro do FinGo:** o asset final enviado ao backend deve ter no máximo 15 MB.
3. **Meta operacional:** preferir GLB <= 8 MB para navegação fluida.
4. **Polígonos:** até 150.000 triângulos por modelo web; preferir <= 75.000 para mobile.
5. **Objeto selecionável:** preferir <= 25.000 triângulos por elemento interativo.
6. **Texturas:** no máximo 2048x2048 por textura e, quando possível, até 4 texturas por asset.
7. **Unidades:** modelar em milímetros no CAD; registrar no metadata a unidade e converter explicitamente ao exportar para web.
8. **Precisão:** não inferir dimensão ausente. Parâmetros obrigatórios devem vir do usuário, do projeto ou de defaults explicitamente documentados.
9. **Topologia:** evitar sólidos inválidos, auto-interseções e peças com volume nulo.
10. **Semântica:** um sólido build123d não vira IFC apenas por receber um nome. Não inventar GUID, Pset ou classificação IFC oficial.
11. **Engenharia:** volume/área derivados dessa geometria são auxiliares. Não usar para orçamento contratual, medição Caixa, ART/RRT, dimensionamento estrutural ou conformidade normativa sem fonte técnica aprovada.
12. **Segurança:** nunca executar scripts baixados da internet sem revisão. Use apenas scripts versionados no repositório.
13. **Determinismo:** toda geração deve partir de parâmetros explícitos e produzir os mesmos resultados para a mesma entrada.

## Workflow

### 1. Criar um arquivo de parâmetros

Exemplo:

```json
{
  "name": "fixture-casa-01",
  "width_mm": 8000,
  "depth_mm": 10000,
  "wall_height_mm": 3000,
  "slab_mm": 150,
  "roof_height_mm": 1600
}
```

### 2. Executar o gerador versionado

```bash
uvx --from build123d python .agents/skills/build123d-cad-modeling/scripts/build_web_asset.py \
  --config /caminho/parametros.json \
  --out-dir /tmp/fingo-bim
```

O script deve gerar:

- `*.glb` para o FinGo;
- `*.step` para inspeção CAD;
- `*.metadata.json` com dimensões, volume, contagem de faces e unidade.

### 3. Validar antes de integrar

```bash
python .agents/skills/generate-3d-model/scripts/validate_glb.py /tmp/fingo-bim/fixture-casa-01.glb
```

### 4. Integrar ao viewer

Somente após a validação:

- testar o asset no preview do PR;
- confirmar orientação dos eixos;
- confirmar escala/unidade;
- manter o arquivo ligado à obra como versão, nunca sobrescrever silenciosamente;
- rodar `npm test` e `node scripts/check-all-syntax.js`.

## Receitas

### Booleanas

Use operações explícitas e pequenas. Prefira compor o objeto por partes e validar cada sólido antes de fundir.

### Exportação

Importe exportadores do módulo principal do build123d. Não assuma submódulos de exportação que não existam.

### Inspeção

Sempre registrar:

- largura, profundidade e altura do bounding box;
- volume;
- quantidade de faces;
- quantidade de arestas;
- caminho dos arquivos produzidos.

## Failure rules

- Se o build123d falhar, não fabrique um GLB vazio.
- Se o GLB exceder 15 MB, interrompa a publicação e otimize.
- Se a geometria não for sólida quando deveria ser, marque a geração como inválida.
- Se medidas estiverem ausentes, peça os parâmetros ou use um fixture claramente identificado como demonstrativo.
