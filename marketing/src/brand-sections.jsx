import React, { useState } from "react";
import { FAQ_ITEMS } from "./faq-data.js";

export function Brand({ compact = false }) {
  return (
    <a
      href="/"
      aria-label="FinGo — Obras em Fluxo"
      className="inline-flex shrink-0 items-center gap-3"
    >
      <img
        src="/img/fingo/fingo-symbol.png"
        alt=""
        className={`${compact ? "h-9 w-9" : "h-11 w-11"} rounded-sm border border-line bg-panel p-1 shadow-lg shadow-acid/15`}
      />
      <span className="flex flex-col items-center gap-1">
        <img
          src="/img/fingo/fingo-wordmark.png"
          alt="FinGo"
          className={`${compact ? "h-6" : "h-7"} w-auto`}
        />
        <span className="text-[10px] font-bold tracking-[0.16em] text-muted">
          OBRAS EM FLUXO
        </span>
      </span>
    </a>
  );
}
export function Faq() {
  return (
    <section
      id="faq"
      className="border-t border-shadow bg-ink py-20 md:py-24"
      aria-labelledby="faq-title"
    >
      <div className="wrap max-w-5xl">
        <div className="mb-12 text-center">
          <p className="eyebrow mb-3">Respostas claras</p>
          <h2 id="faq-title" className="font-display text-4xl uppercase">
            Dúvidas frequentes
          </h2>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <details
              key={question}
              className="group rounded-sm border border-shadow bg-panel transition-colors duration-150 hover:border-line"
            >
              <summary className="flex list-none items-center justify-between gap-5 p-6 font-display text-lg uppercase [&::-webkit-details-marker]:hidden">
                {question}
                <span
                  aria-hidden="true"
                  className="shrink-0 font-sans text-acid group-open:hidden"
                >
                  +
                </span>
                <span
                  aria-hidden="true"
                  className="hidden shrink-0 font-sans text-acid group-open:block"
                >
                  −
                </span>
              </summary>
              <p className="px-6 pb-6 leading-relaxed text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Newsletter() {
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState("subscribe");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/v2/public/newsletter/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error("unavailable");
      setFeedback(
        mode === "subscribe"
          ? "Inscrição confirmada! Obrigado por acompanhar o Radar FinGo."
          : "Sua inscrição foi cancelada.",
      );
      setEmail("");
    } catch {
      setFeedback(
        mode === "subscribe"
          ? "As inscrições estão temporariamente indisponíveis. Tente novamente mais tarde."
          : "Não foi possível confirmar o cancelamento. Tente novamente mais tarde ou fale com nosso suporte.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-title"
      className="border-t border-shadow bg-void pb-20 pt-16"
    >
      <div className="wrap">
        <div className="rounded-sm border border-shadow bg-panel px-6 py-10 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <span className="badge-purple mb-5">
              Radar FinGo • Engenharia & Atualizações
            </span>
            <h2
              id="newsletter-title"
              className="text-2xl font-bold leading-snug md:text-3xl"
            >
              Receba Atualizações SINAPI, Eventos e Novidades do Sistema
            </h2>
            <p className="mb-7 mt-4 text-sm leading-relaxed text-muted">
              Fique por dentro dos lançamentos de recursos, webinars técnicos de
              BDI e novas tabelas oficiais da Caixa Econômica Federal. Cancele
              sua inscrição quando quiser em um clique.
            </p>
            <form
              onSubmit={submit}
              className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row"
              aria-label={
                mode === "subscribe"
                  ? "Inscrição no Radar FinGo"
                  : "Cancelar inscrição no Radar FinGo"
              }
            >
              <label htmlFor="newsletter-email" className="sr-only">
                Seu e-mail corporativo ou pessoal
              </label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu e-mail corporativo ou pessoal"
                disabled={pending}
                className="min-w-0 flex-1 rounded-sm border border-line bg-void px-4 py-3 text-sm outline-none transition-colors focus:border-acid disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={pending}
                className="action shrink-0 font-display uppercase disabled:cursor-wait disabled:opacity-60"
              >
                {pending
                  ? "Enviando…"
                  : mode === "subscribe"
                    ? "Inscrever-se ✓"
                    : "Cancelar inscrição"}
              </button>
            </form>
            <p
              role="status"
              aria-live="polite"
              className="mt-3 text-sm text-paper"
            >
              {feedback}
            </p>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Respeitamos sua privacidade. Zero spam. Você pode{" "}
              <button
                type="button"
                disabled={pending}
                className="underline hover:text-acid"
                onClick={() => {
                  setMode(mode === "subscribe" ? "unsubscribe" : "subscribe");
                  setFeedback("");
                }}
              >
                {mode === "subscribe"
                  ? "cancelar sua inscrição"
                  : "voltar para inscrição"}
              </button>{" "}
              ou{" "}
              <a href="/privacidade" className="underline hover:text-acid">
                gerenciar preferências
              </a>{" "}
              a qualquer momento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
export function Footer() {
  return (
    <footer className="bg-void border-t border-line text-paper">
      <div className="wrap py-14 md:py-16">
        <div className="grid gap-10 md:gap-8 grid-cols-2 sm:grid-cols-2 md:grid-cols-12">
          {/* Coluna 1: Marca & Apresentação */}
          <div className="col-span-2 sm:col-span-2 md:col-span-4 flex flex-col justify-between">
            <div>
              <Brand compact />
              <p className="mt-4 text-xs leading-relaxed text-muted max-w-sm">
                Sistema SaaS de Gestão Financeira, Orçamentária e Operacional para Construtoras e Canteiros de Obras.
              </p>
              <p className="mt-2 text-xs font-mono text-silver">
                FinGo — Obras em Fluxo — Brasil
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-acid animate-pulse" />
              <span className="font-mono text-[11px] text-muted">
                FinGo OS v2.40 • Cloudflare Edge
              </span>
            </div>
          </div>

          {/* Coluna 2: Produto & Soluções */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-acid mb-4">
              Produto
            </h4>
            <nav aria-label="Links do Produto" className="flex flex-col gap-2.5 text-xs text-muted">
              <a href="/planos" className="hover:text-acid transition-colors">
                Planos & Preços
              </a>
              <a href="/manuais" className="hover:text-acid transition-colors">
                Manuais do Sistema
              </a>
              <a href="/calculadora-bdi" className="hover:text-acid transition-colors">
                Calculadora BDI TCU
              </a>
              <a href="/login" className="hover:text-acid transition-colors">
                Área do Cliente
              </a>
              <a href="/validar" target="_blank" rel="noopener noreferrer" className="hover:text-acid transition-colors">
                Validar Documento ICP
              </a>
            </nav>
          </div>

          {/* Coluna 3: Institucional */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-acid mb-4">
              Institucional
            </h4>
            <nav aria-label="Links Institucionais" className="flex flex-col gap-2.5 text-xs text-muted">
              <a href="/sobre-nos" className="hover:text-acid transition-colors">
                Quem Somos
              </a>
              <a href="/blog" className="hover:text-acid transition-colors">
                Blog de Engenharia
              </a>
              <a href="/#newsletter" className="hover:text-acid transition-colors">
                Radar FinGo
              </a>
            </nav>
          </div>

          {/* Coluna 4: Suporte & Contato */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-acid mb-4">
              Suporte
            </h4>
            <nav aria-label="Links de Suporte" className="flex flex-col gap-2.5 text-xs text-muted">
              <a
                href="https://wa.me/5595991363678?text=Olá! Gostaria de falar com o Suporte / Comercial do FinGo."
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-acid transition-colors"
              >
                WhatsApp Suporte ↗
              </a>
              <button
                type="button"
                onClick={() => {
                  const btn = document.querySelector("#finbot-trigger, .finbot-toggle-btn");
                  if (btn) btn.click();
                  else window.location.href = "https://wa.me/5595991363678";
                }}
                className="text-left hover:text-acid transition-colors"
              >
                Chat com FinBot
              </button>
              <a href="/manuais" className="hover:text-acid transition-colors">
                Central de Manuais
              </a>
              <a href="mailto:contato@fingo.api.br" className="hover:text-acid transition-colors">
                contato@fingo.api.br
              </a>
            </nav>
          </div>

          {/* Coluna 5: LGPD & Legal */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-acid mb-4">
              LGPD & Legal
            </h4>
            <nav aria-label="Links de LGPD e Termos" className="flex flex-col gap-2.5 text-xs text-muted">
              <a href="/privacidade" className="hover:text-acid transition-colors">
                Privacidade & LGPD
              </a>
              <a href="/termos" className="hover:text-acid transition-colors">
                Termos de Uso
              </a>
              <a href="/validar" target="_blank" rel="noopener noreferrer" className="hover:text-acid transition-colors">
                Assinatura ICP-Brasil
              </a>
              <a href="/privacidade#direitos-titular" className="hover:text-acid transition-colors">
                Direitos do Titular LGPD
              </a>
            </nav>
          </div>
        </div>

        {/* Rodapé Inferior: Copyright e Informações */}
        <div className="mt-12 border-t border-line/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <p>
            © {new Date().getFullYear()} FinGo — Obras em Fluxo. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 text-[11px] font-mono text-muted">
            <span>Segurança TLS 1.3</span>
            <span>•</span>
            <span>Conformidade LGPD (Lei 13.709/2018)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
