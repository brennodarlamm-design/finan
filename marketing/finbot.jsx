import React, { useEffect, useRef, useState } from "react";
import { PLAN_RULES } from "../api/_plans.js";
import { FAQ_ITEMS } from "./faq-data.js";

const greeting =
  "Olá! Sou o FinBot, assistente do FinGo. Neste primeiro atendimento, posso orientar sobre planos, teste grátis e recursos do sistema. Como posso ajudar?";
const normalize = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function answerQuestion(message) {
  const text = normalize(message);
  if (/atendente|humano|pessoa|comercial|contato|whatsapp/.test(text))
    return "Você pode conversar com nossa equipe pelo botão “Falar com a equipe no WhatsApp” abaixo. O atendimento continua por lá.";
  if (/preco|valor|custa|plano|mensal|anual/.test(text))
    return [
      "Nossos planos mensais são:",
      ...["starter", "pro", "unlimited"].map((id) => {
        const p = PLAN_RULES[id];
        return `${p.label}: ${(p.monthlyPriceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês, ${p.maxUsers} ${p.maxUsers === 1 ? "usuário" : "usuários"} e ${p.maxActiveObras === null ? "obras ilimitadas" : `${p.maxActiveObras} obras ativas`}.`;
      }),
      "Na página Planos você pode comparar recursos e valores dos demais períodos.",
    ].join("\n\n");
  const topics = [
    [/teste|gratis|gratuito|cadastro|cartao|comecar/, 0],
    [/usuario|equipe|acesso|login/, 1],
    [/celular|tablet|canteiro|smartphone/, 2],
    [/sinapi|caixa|base|orcamento/, 3],
    [/suporte|atendimento|ajuda/, 4],
  ];
  for (const [pattern, index] of topics)
    if (pattern.test(text)) return FAQ_ITEMS[index].answer;
  if (/financeiro|medic|obra|recurso|funciona|sistema/.test(text))
    return "O FinGo conecta a gestão de obras, finanças e medições. Os recursos disponíveis variam por plano. O Construtora Ilimitado inclui SINAPI e engenharia. Use “Ver planos” abaixo para comparar.";
  if (/^(oi|ola|bom dia|boa tarde|boa noite|obrigad)/.test(text))
    return "Olá! Posso ajudar a conhecer o FinGo. Você quer saber sobre os planos, o teste grátis de 15 dias ou os recursos para sua obra?";
  return "Ainda não tenho uma resposta pronta para essa dúvida neste primeiro atendimento. Você pode escolher um dos assuntos abaixo ou falar com nossa equipe pelo WhatsApp.";
}
function RobotIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className="h-6 w-6"
    >
      <path d="M12 3v3m-2-3h4M4 11H2m20 0h-2M8 20v2m8-2v2" />
      <rect x="4" y="6" width="16" height="14" rx="3" />
      <path d="M8 11v2m8-2v2m-7 3h6" />
    </svg>
  );
}
export function FinBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([{ role: "bot", text: greeting }]);
  const launcher = useRef(null),
    field = useRef(null),
    log = useRef(null);
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, open]);
  function close() {
    setOpen(false);
    launcher.current?.focus();
  }
  function send(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((previous) => [
      ...previous.slice(-37),
      { role: "user", text: trimmed },
      { role: "bot", text: answerQuestion(trimmed) },
    ]);
    setInput("");
  }
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <section
          id="finbot-panel"
          role="dialog"
          aria-label="Converse com o FinBot"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
          className="flex max-h-[min(640px,calc(100dvh-110px))] w-[min(380px,calc(100vw-40px))] flex-col overflow-hidden rounded-sm border border-acid/40 bg-void shadow-2xl"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-line bg-panel p-4">
            <span className="rounded-sm bg-acid p-2 text-void">
              <RobotIcon />
            </span>
            <div className="flex-1">
              <h2 className="font-bold">FinBot</h2>
              <p className="text-xs text-muted">Primeiro atendimento • FinGo</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar FinBot"
              className="p-2 text-xl hover:text-acid"
            >
              ×
            </button>
          </header>
          <div
            ref={log}
            role="log"
            aria-label="Mensagens do FinBot"
            aria-live="polite"
            aria-relevant="additions"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`rounded-sm p-3 text-sm leading-relaxed ${message.role === "user" ? "ml-8 bg-acid text-void" : "mr-3 bg-panel text-paper"}`}
              >
                <p className="mb-1 text-xs font-bold">
                  {message.role === "user" ? "Você" : "FinBot"}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {message.text}
                </p>
              </div>
            ))}
          </div>
          <div className="shrink-0 border-t border-line p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {["Conhecer planos", "Teste grátis", "Funciona no celular?"].map(
                (topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => send(topic)}
                    className="rounded-sm border border-line px-3 py-2 text-xs hover:border-acid hover:text-acid"
                  >
                    {topic}
                  </button>
                ),
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <label htmlFor="finbot-message" className="sr-only">
                Sua dúvida para o FinBot
              </label>
              <input
                ref={field}
                id="finbot-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={500}
                autoComplete="off"
                placeholder="Escreva sua dúvida…"
                className="min-w-0 flex-1 rounded-sm border border-line bg-panel px-3 py-3 text-sm outline-none focus:border-acid"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Enviar mensagem"
                className="rounded-sm bg-acid px-4 font-bold text-void disabled:opacity-40"
              >
                ↗
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              <a href="/planos" className="text-acid underline">
                Ver planos
              </a>
              <a href="/cadastro" className="text-acid underline">
                Começar teste grátis
              </a>
              <a
                href="https://wa.me/5595991363678?text=Ol%C3%A1!%20Conheci%20o%20FinGo%20e%20gostaria%20de%20tirar%20uma%20d%C3%BAvida."
                target="_blank"
                rel="noopener noreferrer"
                className="text-acid underline"
              >
                Falar com a equipe no WhatsApp
              </a>
            </div>
            <p className="mt-3 text-[11px] text-muted">
              Respostas automáticas sobre o FinGo. Conversa mantida somente
              nesta página. Evite enviar dados pessoais.
            </p>
          </div>
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        aria-expanded={open}
        aria-controls="finbot-panel"
        aria-label={
          open ? "Fechar assistente FinBot" : "Tirar dúvidas com o FinBot"
        }
        onClick={() => (open ? close() : setOpen(true))}
        className="flex items-center gap-3 rounded-sm border border-acid bg-acid px-5 py-4 font-bold text-void shadow-lg hover:bg-paper"
      >
        <RobotIcon />
        <span>{open ? "Fechar" : "Fale com o FinBot"}</span>
      </button>
    </div>
  );
}
