# Arquitetura de Armazenamento de Documentos e Anexos (Cloudflare R2) — FinGo

Este documento detalha o funcionamento, as regras de segurança e o guia operacional para o armazenamento de documentos, plantas, fotos e comprovantes no **Cloudflare R2** com o banco **Neon PostgreSQL**.

---

## 1. Por que Cloudflare R2 em vez de PostgreSQL / Base64?

| Critério | PostgreSQL (Neon) com Base64 | Cloudflare R2 (Object Storage) |
|---|---|---|
| **Cota Gratuita** | 100 MB de storage total | **10 GB gratuitos todo mês** (100x maior) |
| **Taxa de Egress (Download)** | Cobrado por transferência de dados | **Zero taxas de egress (100% gratuito)** |
| **Desempenho de Leitura** | Bloqueia conexões de banco e incha tabelas | Servido via CDN global Cloudflare no Edge |
| **Isolamento de Segurança** | Linhas compartilhadas na tabela | Prefixo isolado por empresa (`tenants/{id}/...`) |
| **Escalabilidade** | Estoura com 50 a 100 comprovantes | Suporta centenas de milhares de arquivos |

---

## 2. Fluxo de Vida do Documento

```
[Navegador do Usuário]
       │
       ├── 1. Seleciona PDF/Comprovante
       │      Salva cópia local em IndexedDB (offline-first)
       │
       ├── 2. POST /api/upload (com payload binário/base64)
       │      Cloudflare Edge Worker recebe a requisição
       │      Valida extensão, MIME type canônico e magic bytes
       │      Grava direto no bucket R2 'fingo-attachments'
       │      Retorna URL canônica: r2://tenants/{tenantId}/documentos/{ano}/{mes}/{hash}_{arquivo}
       │
       └── 3. Sincronização com o Neon PostgreSQL:
              INSERT INTO documentos (
                id, tenant_id, tipo, titulo, tamanho_bytes, url, base64_data
              ) VALUES (
                ..., url = 'r2://...', base64_data = NULL
              )
              (Tamanho da linha no PostgreSQL: ~300 bytes em vez de 2 MB)
```

---

## 3. Configuração dos Buckets no Cloudflare

O FinGo utiliza dois buckets R2 dedicados configurados no `wrangler.jsonc`:

1. **`fingo-attachments`** (Binding: `ATTACHMENTS_R2`):
   - Destinado a fotos de canteiro, plantas baixas, comprovantes de despesa, notas fiscais, contratos assinados e arquivos BIM (.ifc / .glb).
2. **`fingo-backups`** (Binding: `BACKUPS_R2`):
   - Destinado aos snapshots diários automáticos criptografados com AES-GCM-256.

### Como criar os buckets na Cloudflare (via CLI ou Dashboard):

```bash
# Criar bucket de anexos
npx wrangler r2 bucket create fingo-attachments

# Criar bucket de backups diários
npx wrangler r2 bucket create fingo-backups
```

Ou acesse o painel **Cloudflare Dashboard > R2 Object Storage > Create Bucket** e insira os nomes acima.

---

## 4. Políticas de Segurança e Zero Bloat

1. **Proteção Anti-Inchaço no PostgreSQL:**
   - O backend (`api/_db-mutations.js` e `api/_db-sync.js`) rejeita a persistência de base64 quando o documento possui uma URL de armazenamento (`base64_data = NULL`).
2. **Isolamento Estrito Multi-Tenant (U1):**
   - A função `isTenantStorageUrl()` impede que um tenant acesse ou vincule arquivos pertencentes a outro tenant.
3. **Leitura Segura:**
   - Documentos privados são servidos via `/api/v2/edge/storage/file/{key}` com validação de sessão e permissão no módulo de documentos antes de entregar o fluxo de bytes do R2.
4. **Purga Automática do WhatsApp:**
   - Foi ativada uma rotina periódica (`StorageCron`) que purga a tabela `whatsmeow_message_secrets` todo domingo, impedindo que o banco relacional seja consumido por segredos transitórios de mensagens.
