/**
 * FinGo — WebMCP Browser Tools Provider
 * Exposição padronizada de ferramentas do cliente no navegador para agentes de IA
 * conforme WebMCP API (https://webmachinelearning.github.io/webmcp/).
 */
(function() {
  function initWebMcp() {
    const mc = (typeof navigator !== 'undefined' && navigator.modelContext) ||
               (typeof document !== 'undefined' && document.modelContext);
    if (!mc || typeof mc.registerTool !== 'function') return;

    const controller = new AbortController();

    try {
      mc.registerTool({
        name: "search_plans",
        description: "Pesquisa e compara os planos oficiais de assinatura do FinGo (Básico, Profissional e Construtora Ilimitado).",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Termo de busca ou capacidade desejada (ex: 'obras ilimitadas', 'sinapi', 'ocr')."
            }
          }
        },
        signal: controller.signal,
        execute: async (args) => {
          const plans = [
            {
              id: "basico",
              name: "Plano Básico",
              price: "R$ 119,90/mês",
              obras: 3,
              users: 1,
              description: "Ideal para autônomos e pequenos empreiteiros."
            },
            {
              id: "profissional",
              name: "Plano Profissional",
              price: "R$ 279,90/mês",
              obras: 10,
              users: 2,
              highlights: ["NF-e", "Assinatura ICP-Brasil", "OCR de Notas Fiscais"],
              description: "Mais escolhido por construtoras em expansão."
            },
            {
              id: "ilimitado",
              name: "Construtora Ilimitado",
              price: "R$ 499,90/mês",
              obras: "Ilimitadas",
              users: 5,
              highlights: ["SINAPI Oficial 27 Estados", "BDI Diferenciado", "Engenharia Avançada"],
              description: "Operação completa de engenharia e orçamentos de licitação."
            }
          ];
          const q = String(args?.query || '').toLowerCase();
          const filtered = q
            ? plans.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.highlights?.some(h => h.toLowerCase().includes(q)))
            : plans;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(filtered, null, 2)
              }
            ]
          };
        }
      });

      mc.registerTool({
        name: "navigate_to",
        description: "Navega para uma página pública ou recurso oficial do FinGo.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              enum: ["/", "/planos", "/sobre-nos", "/login", "/cadastro"],
              description: "Caminho de destino na plataforma."
            }
          },
          required: ["path"]
        },
        signal: controller.signal,
        execute: async (args) => {
          if (typeof window !== 'undefined' && args?.path) {
            window.location.href = args.path;
            return { content: [{ type: "text", text: `Navegando para ${args.path}` }] };
          }
          return { content: [{ type: "text", text: "Ambiente sem suporte a navegação por janela." }] };
        }
      });

      mc.registerTool({
        name: "get_sinapi_info",
        description: "Consulta a cobertura e base regulatória dos dados SINAPI (Caixa/IBGE) no FinGo.",
        inputSchema: {
          type: "object",
          properties: {
            uf: {
              type: "string",
              description: "Sigla da Unidade Federativa com 2 letras (ex: 'SP', 'RJ', 'MG', 'DF')."
            }
          }
        },
        signal: controller.signal,
        execute: async (args) => {
          const uf = String(args?.uf || 'todos os 27 estados').toUpperCase();
          return {
            content: [
              {
                type: "text",
                text: `O FinGo disponibiliza as bases oficiais completas do SINAPI (Caixa Econômica Federal e IBGE) para ${uf}, incluindo composições analíticas, sintéticas e insumos, com opções desoneradas e não desoneradas conforme Decreto Federal nº 7.983/2013 e Lei nº 14.133/2021.`
              }
            ]
          };
        }
      });
    } catch (err) {
      console.warn('[FinGo WebMCP] Falha no registro de ferramentas:', err?.message || err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebMcp);
  } else {
    initWebMcp();
  }
})();
