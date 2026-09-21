---
name: nfe-processing
description: Processamento inteligente de NF-e, consulta de CNPJ na Receita Federal e cálculo automatizado de retenções tributárias da construção civil.
---

# FinGo Skill: Processamento de NF-e & Retenções Tributárias

Permite que agentes de IA consultem dados cadastrais de fornecedores e subempreiteiros via CNPJ (Receita Federal), importem e analisem XMLs e DANFEs de notas fiscais com extração OCR e apurem retenções obrigatórias (INSS 11%/3,5%, IRRF, PIS/COFINS/CSLL 4,65% e ISS) conforme IN RFB 971/2009 e IN RFB 1234/2012.

## Capacidades

- Consulta em tempo real de situação cadastral e CNAEs de CNPJs.
- Extração de itens, alíquotas e valores de serviços/materiais a partir de XML ou PDF.
- Cálculo de retenções federais e municipais de serviços de empreitada.
- Lançamento automático de contas a pagar provisionadas com as retenções descontadas.

## Endpoints Associados

- `GET /api/nfe?cnpj=<cnpj>`
- `POST /api/upload` (com documento fiscal)
- `POST /api/reconhecer-documento`
