# Módulo de Configurações & Preferências do Sistema

> **Domínio:** `frontend/domains/configuracoes/`  
> **Responsabilidade:** Dados da construtora, gestão de usuários, auditoria, sessões ativas, SLAs, workflows de aprovação e governança da estrutura do sistema.

---

## 1. Componentes do Módulo

| Arquivo | Função Principal |
| :--- | :--- |
| `configuracoes.js` | Painel de preferências da empresa, usuários, auditoria de acessos, prazos de SLA e contas. |
| `master.js` | Painel super-admin exclusivo para operadores, manutenção de banco e visualizador de governança e arquitetura do sistema. |
| `dev-tenant-keys.js` | Chaves de acesso de ambiente e credenciais de tenant. |
| `ocr.js` | Utilitários e histórico de OCR de notas e recibos. |
| `academia.js` | Centro de treinamento e tutoriais guiados para usuários do SaaS. |

---

## 2. Abas de Preferências (`Configuracoes._activeTab`)

1. **🏢 Minha Empresa (`empresa`):** Razão Social, CNPJ, Inscrição Estadual, logotipo, endereço e contatos.
2. **👥 Usuários (`usuarios`):** Cadastro e gerenciamento de membros da construtora com controle de perfis RBAC (Admin, Gestor, Operador, Visualizador). *Apenas administradores.*
3. **🛡️ Auditoria (`auditoria`):** Log estruturado de alterações de dados e eventos de segurança com exportação. *Apenas administradores.*
4. **📱 Sessões (`sessoes`):** Listagem e revogação remota de dispositivos e sessões ativas.
5. **⏱️ SLAs & Prazos (`slas`):** Definição de prazos padrão para etapas de obras e canteiro.
6. **🚧 Workflow & Cargos (`workflow`):** Mapeamento de cargos executivos e responsáveis de etapas.
7. **🏦 Contas Bancárias (`contas`):** Gestão de contas correntes, caixas físicos e conciliação.
8. **🏷️ Categorias (`categorias`):** Plano de contas e categorização financeira de receitas e despesas.

---

## 3. Integração com a Arquitetura Geral

Para consultar a documentação técnica aprofundada:
- **[Estrutura Completa do Sistema Ponta a Ponta](../../docs/architecture/ESTRUTURA_DO_SISTEMA.md)**
- **[Mapeamento de Segurança & Governança](../../docs/security/README.md)**
