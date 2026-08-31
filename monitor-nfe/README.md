# Monitor NF-e — Angelim Construtora
## Consulta automática de NF-es via certificado digital A1

---

## 📁 Arquivos desta pasta

| Arquivo | Descrição |
|---|---|
| `config.json` | ⚙️ **EDITE ESTE ARQUIVO PRIMEIRO** com seus dados |
| `MonitorNFe.ps1` | Script principal — consulta SEFAZ e envia para MeuDanfe |
| `InstalarTarefa.ps1` | Instala execução automática no Agendador de Tarefas |
| `ultimo_nsu.txt` | Criado automaticamente — guarda o progresso das consultas |
| `xmls/` | XMLs das NF-es baixadas ficam aqui |
| `logs/` | Logs de execução ficam aqui |

---

## 🚀 Passo a passo de configuração

### 1. Edite o `config.json`

Abra o arquivo e preencha:

```json
{
  "certificado": {
    "caminho": "C:\\Usuários\\Voce\\certificado.pfx",
    "senha": "sua_senha_aqui"
  },
  "empresa": {
    "cnpj": "12345678000190",
    "razao_social": "Angelim Construtora LTDA",
    "uf": "RR",
    "cod_uf": "14"
  }
}
```

> ⚠️ O CNPJ deve ter **14 dígitos sem pontuação**.
> O `cod_uf` de Roraima é **14** (código IBGE).

### 2. Teste o script manualmente

Abra o PowerShell **como Administrador** e execute:

```powershell
cd "d:\Projects\FINANÇAS\monitor-nfe"
powershell -ExecutionPolicy Bypass -File MonitorNFe.ps1
```

Verifique o log em `logs\monitor_nfe_AAAA-MM.log`.

### 3. Instale o agendamento automático (1x por hora)

Com o PowerShell **como Administrador**:

```powershell
cd "d:\Projects\FINANÇAS\monitor-nfe"
powershell -ExecutionPolicy Bypass -File InstalarTarefa.ps1
```

---

## 🔄 Como funciona o fluxo completo

```
Agendador de Tarefas (a cada 1 hora)
         ↓
   MonitorNFe.ps1
         ↓
  Carrega certificado .pfx
         ↓
  Chama SEFAZ (DistDFeInt) com mTLS
         ↓
  Recebe até 50 NF-es (retDistDFeInt.xml)
         ↓
  Envia para API MeuDanfe (/fd/add/sefaz-xml)
         ↓
  Salva XMLs em ./xmls/
         ↓
  Registra em ./logs/
         ↓
  No sistema financeiro: aba ☁️ "Minhas NFs na Nuvem"
  mostra todas as NFs importadas
```

---

## 📝 Código UF — Roraima

| UF | Código IBGE |
|----|-------------|
| RR | **14** |

---

## ⚠️ Avisos importantes

- O script **não bloqueia** e não trava o computador — roda em background em segundos
- A SEFAZ pode retornar até **50 documentos por consulta** — o script faz quantas consultas forem necessárias até esvaziar a fila
- O arquivo `ultimo_nsu.txt` guarda o progresso — **não delete** esse arquivo, senão o script vai puxar todas as NFs desde o início
- Cada NF nova consultada na SEFAZ custa **R$ 0,03** no MeuDanfe — NFs já na conta são gratuitas
- Logs ficam em `logs\monitor_nfe_AAAA-MM.log` (um arquivo por mês)

---

## 🔧 Comandos úteis

```powershell
# Verificar se a tarefa está instalada
Get-ScheduledTask -TaskName "Monitor NF-e Angelim"

# Rodar manualmente agora
Start-ScheduledTask -TaskName "Monitor NF-e Angelim"

# Ver histórico de execuções
Get-ScheduledTaskInfo -TaskName "Monitor NF-e Angelim"

# Remover a tarefa agendada
Unregister-ScheduledTask -TaskName "Monitor NF-e Angelim" -Confirm:$false

# Ver último log
Get-Content "logs\monitor_nfe_$(Get-Date -Format 'yyyy-MM').log" -Tail 30
```
