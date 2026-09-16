# Regra: Commit Obrigatório Antes do Deploy

Nenhum agente deve executar scripts de build de publicação ou deploy de produção sem que as alterações estejam devidamente comitadas e enviadas ao repositório.

## Fluxo Obrigatório

```text
[1. Testes & Validação]
       ↓
[2. Git Commit com Mensagem Semântica]
       ↓
[3. Git Push para Remote]
       ↓
[4. Deploy em Produção]
```

Qualquer tentativa de inverter essa ordem ou realizar deploy sem commit prévio é estritamente proibida.
