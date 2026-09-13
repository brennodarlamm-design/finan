# Monitor NF-e — Angelim Construtora
## Consulta automática de NF-e via certificado digital A1

Este diretório contém **ferramentas locais de Windows** para consultar a distribuição de DF-e da SEFAZ, enviar os lotes ao MeuDanfe e disparar o resumo financeiro pelo **backend oficial do FinObra**.

> O Monitor NF-e **não é publicado no Render**. O serviço de produção do FinObra usa somente `backend/` e o WhatsApp de produção é atendido pelo backend Baileys do FinObra. Não é necessário executar um servidor WhatsApp local, Evolution API ou `whatsapp-web.js`.

## Arquivos ativos

| Arquivo | Função |
|---|---|
| `config.example.json` | Modelo sem segredos para gerar o `config.json` local |
| `MonitorNFe.ps1` | Consulta SEFAZ por mTLS e envia o lote ao MeuDanfe |
| `InstalarTarefa.ps1` | Agenda a consulta NF-e no Windows |
| `AlertaBoletosWhatsApp.ps1` | Consulta contas do tenant no FinObra e envia o resumo via `/api/send-whatsapp` |
| `AgendarAlertaWhatsApp.ps1` | Agenda o resumo financeiro diário às 08:00 |
| `ultimo_nsu.txt` | Estado local criado/atualizado em execução; **não é versionado** |
| `xmls/` e `logs/` | Saída local; **não são versionados** |

## 1. Configuração

Copie `config.example.json` para `config.json` e preencha os dados da empresa. O `config.json` é ignorado pelo Git.

Além do CNPJ/UF, informe `empresa.tenant_id`, que é o ID interno da empresa no FinObra. Ele é obrigatório para os jobs que usam a chave interna, pois todas as chamadas são isoladas por tenant.

### Segredos recomendados por variável de ambiente

Use preferencialmente estas variáveis no Windows/Agendador de Tarefas:

```powershell
$env:FINOBRA_CERT_PASSWORD = "senha-do-pfx"
$env:MEUDANFE_API_KEY      = "chave-meudanfe"
$env:FINOBRA_API_SECRET    = "segredo-interno-finobra"
```

Os campos equivalentes no `config.json` existem apenas como fallback local. Nunca envie `config.json`, `.pfx`, `.p12`, logs ou XMLs ao Git.

## 2. Monitor NF-e / SEFAZ

Execute como usuário que tenha acesso ao certificado:

```powershell
cd "d:\Projects\FINANÇAS\monitor-nfe"
powershell -ExecutionPolicy Bypass -File MonitorNFe.ps1
```

O fluxo é:

```text
Agendador de Tarefas
  -> MonitorNFe.ps1
  -> certificado A1 carregado pelo processo
  -> HTTPS/mTLS com validação TLS normal
  -> SEFAZ DistDFeInt
  -> parser XML com DTD/resolução externa desabilitados
  -> MeuDanfe
  -> XMLs/logs locais
```

O certificado não é marcado como exportável, a senha do PFX não é passada na linha de comando do sistema e a chamada à SEFAZ não usa `curl -k`.

Para instalar o agendamento da consulta:

```powershell
powershell -ExecutionPolicy Bypass -File InstalarTarefa.ps1
```

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

## 4. Estado NSU

`ultimo_nsu.txt` guarda o progresso local da distribuição de DF-e. Ele é criado/atualizado pelo monitor e agora fica fora do controle de versão. **Não apague o arquivo da máquina em uso** sem saber o impacto, pois reiniciar o NSU pode alterar o comportamento das consultas seguintes.

## 5. Segurança operacional

- Use somente o endpoint oficial configurado no `config.example.json`.
- Não desative validação TLS para a SEFAZ.
- Não compartilhe o certificado ou sua senha.
- Mantenha o `FINOBRA_API_SECRET` apenas em ambiente seguro/local.
- O diretório `monitor-nfe` é utilitário local; a infraestrutura de produção permanece em `backend/`, Vercel/API e Cloudflare.
