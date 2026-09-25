# Trilha Patch 54.1: Fotos e Evidências de Campo (spec.md)

> **Contexto Conductor**  
> **Trilha:** `patch54-evidencias-campo`  
> **Status:** Pronto para Início  
> **Data de Criação:** 2026-09-25  
> **Responsável:** Antigravity AI  
> **Pilar:** Patch 54 (Sub-trilha 1/3)

---

## 1. Problema e Justificativa

Durante o avanço físico das obras, gestores e engenheiros de campo precisam registrar evidências fotográficas e documentais (comprovantes de entrega de concreto, ensaios de rompimento, laudos técnicos, fotos de armadura antes da concretagem).  
Atualmente:
- As etapas de workflow em `workflow_etapas` possuem apenas texto de observação e máquina de estados (`pendente`, `em_andamento`, `concluido`).
- Falta um vínculo formal entre as fotos de canteiro e os marcos/etapas específicas do cronograma.
- A ausência de evidências visuais auditáveis dificulta a aprovação de boletins de medição por clientes e bancos financiadores (Caixa/CEF).

---

## 2. Objetivos da Trilha

1. **Vínculo Direto de Evidências por Etapa:**
   - Permitir upload de múltiplas fotos e documentos diretamente na gaveta/modal da etapa de workflow (`workflow_etapas`).
   - Suporte a metadados: data/hora da captura, descrição técnica, coordenadas GPS opcionais e responsável pelo upload.

2. **Armazenamento Seguro e Otimizado:**
   - Upload com streaming direto para o bucket Cloudflare R2 (`fingo-attachments`).
   - Pré-processamento e compressão cliente em formato moderno WebP para fotos acima de 2MB, respeitando o teto de 15 MB por arquivo.
   - Registro atômico de metadados em tabela de banco com Row-Level Security (RLS) estrito por `tenant_id`.

3. **Experiência de Visualização (Galeria & Antes/Depois):**
   - Galeria fotográfica responsiva por etapa na Central do Gestor e na Visão 360º da Obra (`obra_detalhe.js`).
   - Modal lightbox para inspeção de fotos em alta resolução com zoom e alternância rápida.
   - Tagging de status: evidência de início, progresso e conclusão da etapa.

---

## 3. Critérios de Aceite

- [ ] Tabela `workflow_etapas_evidencias` criada no Neon Postgres com RLS e predicado `tenant_id`.
- [ ] Endpoints da API `api/_workflow.js` atualizados com ações `add_evidencia`, `list_evidencias` e `delete_evidencia`.
- [ ] Interface no frontend (`cronograma_sla.js` e `central_gestor.js`) permitindo upload drag-and-drop e visualização em miniatura.
- [ ] Compressão cliente e validação estrita de tipos permitidos (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
- [ ] Suíte de testes automatizada cobrindo isolamento multi-tenant, upload e integridade das evidências.
