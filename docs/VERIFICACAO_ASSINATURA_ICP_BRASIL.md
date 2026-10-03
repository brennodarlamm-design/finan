# Verificação de assinaturas digitais em PDF (ICP-Brasil e Gov.br)

## O que o FinGo faz

Em **Contratos** e **Recibos**, o botão **🛡️ Verificar PDF assinado** recebe o PDF assinado (pelo Gov.br ou com certificado ICP-Brasil) e confere, para cada assinatura:

| Verificação | Como |
|---|---|
| Integridade | O hash dos trechos assinados (`/ByteRange`) bate com a assinatura CMS, e a assinatura criptográfica do titular é válida |
| Cadeia de confiança | O certificado chega a uma raiz oficial: **AC Raiz ICP-Brasil** (v1–v12) → nível **qualificada**; **AC Raiz do Governo Federal do Brasil v1 (Gov.br)** → nível **avançada** |
| Revogação | Baixa e valida a LCR indicada no certificado (assinada pela AC emissora) |
| Alterações posteriores | Indica se o PDF recebeu conteúdo depois da última assinatura |

Resultado (mesma classificação do Verificador do ITI / ETSI EN 319 102-1):
- **Válida**: íntegra, cadeia oficial e LCR consultada sem revogação.
- **Inconclusiva** (indeterminada): cadeia não reconhecida, LCR indisponível, certificado expirado sem carimbo do tempo ou alteração após a última assinatura.
- **Inválida**: conteúdo alterado, assinatura que não confere ou certificado revogado.

Cada verificação fica registrada em `document_signature_verifications` (hash SHA-256 do arquivo, resultado, signatários com CPF/CNPJ mascarados e relatório técnico) e no log de auditoria. A tabela tem RLS por empresa, e a aplicação só pode inserir e consultar, sem alterar nem apagar.

## Validade jurídica

A validade vem da **assinatura**, não do verificador:
- **Qualificada (ICP-Brasil):** presunção de veracidade (MP 2.200-2/2001, art. 10, §1º; Lei 14.063/2020, art. 4º, III).
- **Avançada (Gov.br):** admitida nas hipóteses da Lei 14.063/2020, art. 4º, II.

O FinGo comprova que a verificação foi feita (data, hash e resultado). Para o relatório oficial de conformidade (DOC-ICP-15), o modal leva ao [validar.iti.gov.br](https://validar.iti.gov.br). O ITI orienta que integrações automáticas **não** chamem o Verificador no domínio dele; quem integra deve hospedar o próprio.

## Arquitetura

- `api/_pdf-signature.js`: extrai as assinaturas do PDF, valida o CMS (`pkijs`), monta a cadeia, consulta a LCR e classifica.
- `api/_trust-anchors-br.js`: raízes oficiais com impressão digital SHA-256 fixada (conferida ao carregar).
- `api/_icp-intermediates.txt`: ACs intermediárias, usadas só para montar a cadeia (não são âncoras).
- `api/assinaturas.js`: `POST /api/assinaturas?action=verificar_pdf` e `GET ?action=verificacoes`.
- **Execução no Render (Node):** o Worker encaminha `verificar_pdf` ao backend, porque cadeia + LCR passam do limite de CPU do plano gratuito do Workers. Com o Render gratuito "dormindo", a primeira verificação pode levar até 1 minuto.
- **Proteção contra SSRF:** endereços de LCR e AIA vêm do certificado; só `http(s)` em portas padrão, com nome de domínio (sem IP, `localhost` ou nomes internos).

## Fonte das raízes e atualização

Raízes e intermediárias foram extraídas do **Demoiselle Signer (SERPRO)**, `github.com/demoiselle/signer`, commit `25f47d98` (04/09/2026):
- `chain-icp-brasil/src/scripts_keytool/cadeiasicpbrasil.bks`
- `chain-iti/src/main/resources/trustedca`

As raízes v1, v2 e v5 conferem com outro módulo do mesmo projeto (`policy-impl-cades`). As ACs reais do pacote (AC SOLUTI v5, AC Certisign G8, AC VALID v5, AC SERPRO v5, AC Final Gov.br) validam criptograficamente até essas raízes.

| Raiz | SHA-256 (início) |
|---|---|
| AC Raiz ICP-Brasil v5 | `CA:A5:3F:C6:09:1C:69:51` |
| AC Raiz ICP-Brasil v10 | `6E:0B:FF:06:9A:26:99:4C` |
| AC Raiz ICP-Brasil v11 | `14:06:71:00:58:18:0F:A4` |
| AC Raiz ICP-Brasil v12 | `D8:47:8E:37:CE:19:C6:90` |
| AC Raiz Gov.br v1 | `16:3B:D0:03:BC:0D:F2:BE` |

**Recomendado:** conferir as impressões digitais completas (em `api/_trust-anchors-br.js`) contra o Repositório AC-Raiz do ITI (gov.br/iti → Repositório AC-Raiz). O ambiente da auditoria não tinha acesso ao site do ITI.

**Atualizar** quando a ICP-Brasil publicar nova raiz ou AC: reexportar o keystore do Demoiselle (ou o `ACcompactadox.zip` do repositório da AC Raiz), regenerar os dois arquivos e rodar `node scripts/test-icp-pdf-signature.js`.

## Limitações conhecidas

- O carimbo do tempo é detectado, mas não validado; sem ele, a data da assinatura é a declarada pelo signatário.
- A revogação é conferida só no certificado do titular; a das ACs intermediárias não é consultada.
- Assinaturas XAdES/CAdES destacadas (`.p7s` separado) ainda não são aceitas, só PDF com assinatura embutida (PAdES).

## Deploy

1. Aplicar `migrations/038_document_signature_verifications.sql` no Neon.
2. Deploy do Render: instala `pkijs` e `asn1js` do `backend/package.json`.
3. Deploy do Worker.
4. Teste: assine um PDF no assinador.iti.br, use **🛡️ Verificar PDF assinado** num contrato e confira o resultado com o validar.iti.gov.br.
