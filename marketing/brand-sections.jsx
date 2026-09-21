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
      className="bg-void py-20 md:py-24"
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
              className="group rounded-sm border border-line bg-panel"
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
      className="bg-void pb-20 pt-8"
    >
      <div className="wrap">
        <div className="rounded-sm border border-acid/15 bg-void px-6 py-10 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-5 inline-block rounded-sm border border-acid/30 bg-acid/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-acid">
              Radar FinGo • Engenharia & Atualizações
            </p>
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
                className="min-w-0 flex-1 rounded-sm border border-line bg-void px-4 py-3 text-sm outline-none focus:border-acid disabled:opacity-60"
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
    <footer className="bg-void border-t border-line">
      <div className="wrap py-12">
        <div className="flex flex-col justify-between gap-9 lg:flex-row">
          <div className="shrink-0">
            <Brand compact />
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Sistema SaaS de Gestão Financeira e Operacional para Construtoras.
              <br />
              FinGo — Obras em Fluxo — Brasil
            </p>
          </div>
          <nav
            aria-label="Rodapé"
            className="flex max-w-2xl flex-wrap content-start gap-x-5 gap-y-4 text-xs text-muted [&_a:hover]:text-acid"
          >
            <a href="/login">Área do Cliente</a>
            <a href="/#newsletter">Newsletter & Novidades</a>
            <a href="/validar" target="_blank" rel="noopener noreferrer">
              Validar Documento ICP
            </a>
            <a href="/privacidade">Privacidade & LGPD</a>
            <a href="/termos">Termos de Uso</a>
            <a
              href="https://wa.me/5595991363678?text=Olá! Gostaria de falar com o Suporte / Comercial do FinGo."
              target="_blank"
              rel="noopener noreferrer"
            >
              Suporte WhatsApp
            </a>
            <a href="/planos">Planos</a>
            <a href="/sobre-nos">Sobre nós</a>
          </nav>
        </div>
        <p className="mt-10 text-xs text-muted">
          © {new Date().getFullYear()} FinGo — Obras em Fluxo. Todos os direitos
          reservados.
        </p>
      </div>
    </footer>
  );
}
