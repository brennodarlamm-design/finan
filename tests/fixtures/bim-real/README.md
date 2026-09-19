# BIM real-model QA fixtures

Estes arquivos IFC são cópias de datasets públicos do repositório oficial **buildingSMART/Certification-datasets** e são usados exclusivamente para regressão/compatibilidade do BIM Viewer do FinGo.

Fonte: `buildingSMART/Certification-datasets` (branch `main`).

Arquivos incluídos:
- `ifc2x3-building-architecture.ifc` — IFC2x3 Simple-Scene / Building Architecture
- `ifc4-wall-opening-window.ifc` — IFC4 Reference View / wall-with-opening-and-window
- `ifc4-building-architecture.ifc` — IFC4 Simple-Scene / Building Architecture
- `ifc4-building-hvac.ifc` — IFC4 Simple-Scene / Building HVAC
- `ifc4-building-structural.ifc` — IFC4 Simple-Scene / Building Structural
- `ifc43-building-architecture.ifc` — IFC4.3 Simple-Scene / Building Architecture

A presença destes arquivos no repositório não significa que o FinGo declare conformidade normativa buildingSMART. O gate mede apenas a capacidade do viewer de ler, tessellar, classificar e coordenar o subconjunto geométrico implementado. Validação normativa IFC permanece uma etapa separada.

Os arquivos-fonte pertencem à buildingSMART International Ltd.; consulte o LICENSE do repositório de origem antes de redistribuir fora deste projeto.
