# Monitor NF-e — Angelim Construtora
## Consulta automática de NF-e via certificado digital A1

Este diretório contém **ferramentas locais de Windows** para consultar a distribuição de DF-e da SEFAZ, enviar os lotes ao MeuDanfe e disparar o resumo financeiro pelo **backend oficial do FinObra**.

> O Monitor NF-e **não é publicado no Render**. O serviço de produção do FinObra usa somente `backend/` e o WhatsApp de produção é atendido pelo backend Baileys do FinObra. Não é necessário executar um servidor WhatsApp local, Evolution API ou `whatsapp-web.js`.

## Arquivos ativos

| Arquivo | Função |
|---|---|
| `config.example.json` | Modelo sem segredos para gerar o `config.json` local |
| `AlertaBoletosWhatsApp.ps1` | Consulta contas do tenant no FinObra e envia o resumo via `/api/send-whatsapp` |
| `AgendarAlertaWhatsApp.ps1` | Agenda o resumo financeiro diário às 08:00 |
| `logs/` | Saída local de logs do alerta de boletos; **não são versionados** |

> **Nota importante sobre DF-e / NF-e:** O script local `MonitorNFe.ps1` e o agendamento `InstalarTarefa.ps1` foram **descontinuados e removidos**. O FinGo agora possui o monitor nativo de DF-e rodando diretamente no backend cloud (`backend/domains/fiscal/_sefaz-dfe.js` e `api/_sefaz-dfe.js`). Múltiplas consultas concorrentes com o mesmo certificado A1 violam as regras da SEFAZ e geram rejeição 656 ("Consumo Indevido"). Todas as consultas e reconciliação de NSU são centralizadas no backend.

## 3. Resumo de boletos por WhatsApp

`AlertaBoletosWhatsApp.ps1` usa a API oficial do FinObra. As requisições internas enviam:

- `Authorization: Bearer <FINOBRA_API_SECRET>`;
- `x-api-key`;
- `x-tenant-id` com `empresa.tenant_id`.

Isso evita leitura acidental de outro tenant e é compatível com a autenticação atual do FinObra.

Para agendar o resumo diário:

```powershell
powershell -ExecutionPolicy Bypass -File AgendarAlertaWhatsApp.ps1
```

## 4. Segurança operacional

- Mantenha o `FINOBRA_API_SECRET` apenas em ambiente seguro/local.
- O diretório `monitor-nfe` é utilitário local para alertas operacionais; a infraestrutura de produção e o monitoramento DF-e permanecem em `backend/` e Cloudflare.
