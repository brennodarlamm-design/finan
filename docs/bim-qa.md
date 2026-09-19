# FinGo BIM — QA final

Este documento descreve o gate de qualidade usado antes de promover o BIM Viewer para produção.

## Gate obrigatório em pull requests

O workflow `.github/workflows/bim-pr-validation.yml` executa:

1. regressões IFC sintéticas/determinísticas;
2. importador OBJ/GLTF/IFC;
3. QA com 6 arquivos IFC reais da buildingSMART;
4. clash engine;
5. renderer/performance;
6. integração do viewer;
7. suíte estática completa;
8. sintaxe;
9. build Cloudflare;
10. Wrangler dry-run.

O comando local equivalente para os arquivos reais é:

```bash
npm run test:bim-real
```

Ele produz:

- `.qa/bim-real-qa.json`
- `.qa/bim-real-qa.md`

No GitHub Actions, esses arquivos são publicados no artifact `bim-real-qa-report`.

## Modelos reais obrigatórios

Os fixtures versionados em `tests/fixtures/bim-real/` cobrem:

- IFC2x3 — arquitetura;
- IFC4 — arquitetura;
- IFC4 — HVAC;
- IFC4 — estrutura;
- IFC4 — wall/opening/window;
- IFC4.3 — arquitetura.

Origem: `buildingSMART/Certification-datasets`.

## Critérios de aceite

Cada fixture precisa:

- ser menor que o limite atual de upload de 15 MB;
- detectar o schema esperado;
- gerar pelo menos um elemento renderizável;
- gerar triângulos finitos/válidos;
- manter IDs de elementos únicos;
- ter pelo menos um elemento elegível ao clash;
- ficar abaixo de 150.000 triângulos após importação;
- concluir o parse dentro do budget definido por `BIM_QA_MAX_PARSE_MS` (default 6 s).

O smoke de coordenação usa coordenadas IFC brutas para não destruir o alinhamento entre disciplinas. Arquitetura, estrutura e HVAC são combinados e passam pelo motor BVH/triângulo-triângulo com orçamento de comparações.

## Stress com modelos maiores

O workflow `.github/workflows/bim-large-real-qa.yml` pode ser executado manualmente e também roda quando a própria infraestrutura de stress é alterada.

Conjuntos:

- `building`: arquitetura, estrutura e plumbing;
- `infra`: bridge e landscaping.

Os modelos são baixados do repositório oficial da buildingSMART somente durante o job; não ficam versionados no FinGo.

Comando do runner:

```bash
node scripts/run-bim-large-qa.js <arquivo.ifc> [outro.ifc] \
  --json=.qa/bim-large-qa.json \
  --markdown=.qa/bim-large-qa.md
```

Budget default de parse por arquivo grande: 15 s, configurável por `BIM_QA_LARGE_MAX_PARSE_MS`.

## Resultado de referência do PR #16

No fechamento do hardening BIM:

- 6/6 fixtures reais obrigatórios passaram;
- IFC2x3 Architecture: 11 elementos / 1.010 triângulos;
- IFC4 Opening+Window: 2 elementos / 40 triângulos;
- IFC4 Architecture: 10 elementos / 1.070 triângulos;
- IFC4 HVAC: 3 elementos / 932 triângulos;
- IFC4 Structural: 13 elementos / 1.292 triângulos;
- IFC4.3 Architecture: 9 elementos / 1.024 triângulos;
- coordenação Architecture × Structural × HVAC: 18 clashes confirmados em 17.586 comparações;
- IFC4 Infra Bridge: 1,66 MB / 46 elementos / 12.764 triângulos / ~264 ms;
- IFC4 Infra Landscaping: 2,24 MB / 25 elementos / 3.700 triângulos / ~90 ms.

Os tempos acima são uma referência de um runner GitHub hospedado e não um SLA de navegador.

## Limite da validação

Este QA mede robustez do parser, geometria, performance e coordenação do **FinGo**. Ele não substitui:

- EXPRESS/schema validation;
- MVD/IDS validation;
- regras normativas buildingSMART;
- certification/validation service oficial.

Um arquivo pode passar no FinGo e ainda conter erros normativos fora do escopo do viewer.
