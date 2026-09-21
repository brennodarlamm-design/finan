import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PLAN_RULES,
  PLAN_CYCLE_PRICING,
  PLAN_BILLING_CYCLES,
  PLAN_MODULE_CATALOG,
} from "../api/_plans.js";
import "./styles.css";
import { FinBot } from "./finbot.jsx";
import { FeatureTour } from "./feature-tour.jsx";
import { Brand, Faq, Newsletter, Footer } from "./brand-sections.jsx";
import { TRILHAS, MANUAIS } from "./manuais-data.js";
import { ARTIGOS_BLOG } from "./blog-data.js";

const route = location.pathname.replace(/\/$|\.html$/g, "") || "/";
const current =
  route === "/planos"
    ? "plans"
    : route === "/sobre-nos"
      ? "about"
      : route === "/manuais"
        ? "manuais"
        : route === "/blog"
          ? "blog"
          : "home";
const contact = "https://wa.me/5595991363678";
const money = (cents) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paid = ["starter", "pro", "unlimited"];

function Header() {
  const [open, setOpen] = useState(false);
  const [institucionalOpen, setInstitucionalOpen] = useState(false);
  const [mobileInstitucionalOpen, setMobileInstitucionalOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setInstitucionalOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setInstitucionalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const links = [
    ["/", "Início", "home"],
    ["/planos", "Planos", "plans"],
  ];

  return (
    <header className="relative z-20 border-b border-line bg-void">
      <div className="wrap flex min-h-24 items-center justify-between gap-6">
        <Brand />
        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-9 md:flex"
        >
          {links.map(([url, label, id]) => (
            <a
              key={id}
              href={url}
              aria-current={id === current ? "page" : undefined}
              className={
                id === current ? "text-acid font-bold" : "text-muted hover:text-paper"
              }
            >
              {label}
            </a>
          ))}

          {/* Mega Menu Dropdown Trigger */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setInstitucionalOpen((v) => !v)}
              aria-expanded={institucionalOpen}
              className={`inline-flex items-center gap-1.5 transition-colors duration-150 ${
                ["about", "manuais", "blog"].includes(current) || institucionalOpen
                  ? "text-acid font-bold"
                  : "text-muted hover:text-paper"
              }`}
            >
              <span>Institucional</span>
              <svg
                className={`h-4 w-4 transition-transform duration-200 ${
                  institucionalOpen ? "rotate-180 text-acid" : "text-muted"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Mega Menu Panel */}
            {institucionalOpen && (
              <div
                className="mega-menu-panel z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                role="region"
                aria-label="Menu Institucional"
              >
                <div className="grid gap-8 lg:grid-cols-12">
                  {/* Apresentação Esquerda */}
                  <div className="flex flex-col justify-between border-b border-shadow pb-6 lg:col-span-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                    <div>
                      <span className="font-mono text-xs uppercase tracking-widest text-acid">
                        Institucional // FinGo
                      </span>
                      <h3 className="font-display mt-3 text-2xl uppercase leading-tight text-paper">
                        Construir exige visão. <br />
                        <span className="text-acid">Gerir também.</span>
                      </h3>
                      <p className="mt-3 text-xs leading-relaxed text-muted">
                        Plataforma integrada de engenharia, finanças e canteiro de obras. 
                        Projetada para dar clareza aos custos e velocidade à operação de construtoras no Brasil.
                      </p>
                    </div>
                    <div className="mt-6">
                      <a
                        href="/sobre-nos"
                        onClick={() => setInstitucionalOpen(false)}
                        className="action text-xs py-3 px-5 inline-flex items-center gap-2"
                      >
                        <span>Conheça nossa trajetória</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </div>

                  {/* Grade Direita de Links Oficiais */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
                    <a
                      href="/sobre-nos"
                      onClick={() => setInstitucionalOpen(false)}
                      className="group rounded-sm border border-shadow bg-void p-4 transition-all duration-150 hover:border-acid/50 hover:bg-panel"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">🏛️</span>
                        <h4 className="font-bold text-sm text-paper group-hover:text-acid">
                          Quem Somos
                        </h4>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">
                        Propósito, história e princípios de engenharia no canteiro.
                      </p>
                    </a>

                    <a
                      href="/manuais"
                      onClick={() => setInstitucionalOpen(false)}
                      className="group rounded-sm border border-shadow bg-void p-4 transition-all duration-150 hover:border-acid/50 hover:bg-panel"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">📚</span>
                        <h4 className="font-bold text-sm text-paper group-hover:text-acid">
                          Manuais do Sistema
                        </h4>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">
                        12 guias práticos ilustrados com telas e exportação para PDF.
                      </p>
                    </a>

                    <a
                      href="/blog"
                      onClick={() => setInstitucionalOpen(false)}
                      className="group rounded-sm border border-shadow bg-void p-4 transition-all duration-150 hover:border-acid/50 hover:bg-panel"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">📐</span>
                        <h4 className="font-bold text-sm text-paper group-hover:text-acid">
                          Blog de Engenharia
                        </h4>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">
                        Artigos técnicos: BDI TCU, retenções INSS/ISS, SINAPI e custos.
                      </p>
                    </a>

                    <a
                      href={contact}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setInstitucionalOpen(false)}
                      className="group rounded-sm border border-shadow bg-void p-4 transition-all duration-150 hover:border-acid/50 hover:bg-panel"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">💬</span>
                        <h4 className="font-bold text-sm text-paper group-hover:text-acid">
                          Atendimento & Suporte
                        </h4>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">
                        Fale diretamente com nossa equipe técnica via WhatsApp.
                      </p>
                    </a>
                  </div>
                </div>

                {/* Faixa de Destaque Inferior */}
                <div className="mt-6 border-t border-shadow pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-panel/60 -mx-6 -mb-6 px-6 py-3.5 rounded-b-sm">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="badge-acid">DESTAQUE</span>
                    <span className="text-paper font-semibold">
                      Calculadora BDI Online Oficial:
                    </span>
                    <span className="text-muted hidden md:inline">
                      Acórdão 2622/2013 do TCU. Calcule gratuitamente em segundos.
                    </span>
                  </div>
                  <a
                    href="/calculadora-bdi"
                    onClick={() => setInstitucionalOpen(false)}
                    className="text-xs font-bold text-acid hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    <span>Acessar calculadora</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </nav>
        <a href="/login" className="outline-action hidden md:inline-flex">
          Acessar o sistema ↗
        </a>
        <button
          className="outline-action md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? "Fechar" : "Menu"}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Navegação móvel"
          className="wrap flex flex-col gap-4 pb-7 md:hidden border-t border-line/40 pt-4"
        >
          <a
            href="/"
            aria-current={current === "home" ? "page" : undefined}
            className={current === "home" ? "text-acid font-bold" : "text-paper"}
          >
            Início
          </a>
          <a
            href="/planos"
            aria-current={current === "plans" ? "page" : undefined}
            className={current === "plans" ? "text-acid font-bold" : "text-paper"}
          >
            Planos
          </a>

          {/* Acordeão Institucional no Mobile */}
          <div className="rounded-sm border border-shadow bg-panel p-3.5">
            <button
              type="button"
              onClick={() => setMobileInstitucionalOpen(!mobileInstitucionalOpen)}
              className="flex w-full items-center justify-between font-mono text-xs uppercase tracking-wider text-acid"
            >
              <span>Institucional</span>
              <span className="text-sm font-bold">{mobileInstitucionalOpen ? "−" : "+"}</span>
            </button>
            {mobileInstitucionalOpen && (
              <div className="mt-3 flex flex-col gap-3 text-sm pl-2 border-l border-line">
                <a href="/sobre-nos" className="text-muted hover:text-paper">
                  🏛️ Quem Somos
                </a>
                <a href="/manuais" className="text-muted hover:text-paper">
                  📚 Manuais do Sistema (12 Guias)
                </a>
                <a href="/blog" className="text-muted hover:text-paper">
                  📐 Blog de Engenharia & Custos
                </a>
                <a href="/calculadora-bdi" className="text-muted hover:text-paper">
                  ⚡ Calculadora BDI Online Oficial
                </a>
                <a
                  href={contact}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-paper"
                >
                  💬 Atendimento WhatsApp
                </a>
              </div>
            )}
          </div>

          <a href="/login" className="action text-center mt-2">
            Acessar o sistema ↗
          </a>
        </nav>
      )}
    </header>
  );
}
function HeroVideo() {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (media.matches) ref.current?.pause();
      else ref.current?.play().catch(() => {});
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return (
    <>
      <img
        src="/img/fingo/construction-background.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster="/img/fingo/construction-background.jpg"
        aria-hidden="true"
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover ${failed ? "hidden" : ""}`}
      >
        <source
          src="/img/fingo/construction-background.mp4"
          type="video/mp4"
          onError={() => setFailed(true)}
        />
      </video>
      <div className="absolute inset-0 bg-linear-to-r from-void via-void/80 to-void/20" />
    </>
  );
}
function Home() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <HeroVideo />
        <div className="wrap relative py-24 md:py-36">
          <p className="eyebrow">Gestão para a construção civil / FinGo</p>
          <h1 className="page-title max-w-3xl">
            Sua obra avança.
            <br />
            <span className="text-acid">
              Sua gestão
              <br />
              acompanha.
            </span>
          </h1>
          <p className="mb-9 mt-8 max-w-lg text-lg leading-relaxed text-paper">
            Do canteiro ao escritório. Obras, finanças e equipe conectadas para
            você construir com mais controle.
          </p>
          <a className="action" href="/planos">
            Conheça os planos <span aria-hidden="true">↗</span>
          </a>
          <p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted">
            FinGo — Obras em fluxo.
          </p>
        </div>
      </section>
      <section className="border-y border-shadow bg-ink">
        <div className="wrap grid gap-4 py-8 text-sm md:grid-cols-3">
          <div className="group rounded-sm border border-shadow bg-panel p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-acid/40">
            <span className="font-mono text-xs font-bold text-acid">01 //</span>
            <p className="mt-2 font-display text-base uppercase text-paper">
              Clareza sobre os custos
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Previsibilidade orçamentária, Curva ABC e controle real de insumos no canteiro.
            </p>
          </div>
          <div className="group rounded-sm border border-shadow bg-panel p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-acid/40">
            <span className="font-mono text-xs font-bold text-acid">02 //</span>
            <p className="mt-2 font-display text-base uppercase text-paper">
              Operação conectada
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Canteiro e escritório sincronizados: compras, notas e medições no mesmo fluxo.
            </p>
          </div>
          <div className="group rounded-sm border border-shadow bg-panel p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-acid/40">
            <span className="font-mono text-xs font-bold text-acid">03 //</span>
            <p className="mt-2 font-display text-base uppercase text-paper">
              Decisões com contexto
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Métricas consolidadas e relatórios técnicos para agir antes de desvios de margem.
            </p>
          </div>
        </div>
      </section>
      <section className="wrap py-24">
        <p className="eyebrow">Da primeira decisão à próxima entrega</p>
        <div className="grid gap-12 lg:grid-cols-2">
          <h2 className="font-display text-4xl uppercase md:text-5xl">
            Menos informação espalhada.
            <br />
            <span className="text-acid">Mais visão da obra.</span>
          </h2>
          <p className="max-w-lg text-lg leading-relaxed text-muted">
            Cada compra, pagamento e medição faz parte da mesma operação. O
            FinGo reúne essas rotinas para aproximar quem planeja de quem
            executa.
          </p>
        </div>
        <div className="mt-14 grid gap-px border border-line bg-line md:grid-cols-3">
          {[
            [
              "01",
              "Obras & equipe",
              "Acompanhe obras e clientes e mantenha as informações da operação organizadas.",
            ],
            [
              "02",
              "Gestão financeira",
              "Conecte contas, despesas e recebimentos à realidade de cada obra.",
            ],
            [
              "03",
              "Medições & planejamento",
              "Acompanhe medições e escolha um plano com os recursos de engenharia que sua operação precisa.",
            ],
          ].map(([n, title, text]) => (
            <article key={n} className="bg-void p-8 transition-colors duration-150 hover:bg-panel">
              <span className="font-mono text-acid">{n} ↗</span>
              <h3 className="mb-4 mt-10 text-xl font-bold">{title}</h3>
              <p className="leading-relaxed text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <ProductShowcase />
    </>
  );
}

function ProductShowcase() {
  const [activeTab, setActiveTab] = useState("kpis");
  return (
    <section className="border-y border-shadow bg-ink py-20">
      <div className="wrap">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Interface & Controle Operacional</p>
            <h2 className="font-display text-3xl uppercase md:text-4xl">
              Engenharia e finanças <span className="text-acid">no mesmo ambiente</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-purple">● SINAPI 27 Estados</span>
            <span className="badge-acid">● FinGo OS v2.38</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border border-shadow bg-void shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-shadow bg-panel px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-acid" />
              </span>
              <span className="font-mono text-xs uppercase tracking-wider text-muted">
                OBRA: EDIFÍCIO HORIZON // TORRE A • STATUS: NO PRAZO
              </span>
            </div>
            <div className="flex gap-1">
              {[
                ["kpis", "Painel Executivo"],
                ["medicoes", "Boletim de Medição"],
                ["sinapi", "Tabela SINAPI"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`rounded-sm px-3 py-1.5 text-xs font-bold transition-all ${
                    activeTab === id
                      ? "bg-acid text-void"
                      : "bg-void text-muted hover:text-paper"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 md:p-8">
            {activeTab === "kpis" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-sm border border-shadow bg-panel p-4">
                    <p className="font-mono text-xs uppercase text-muted">Contrato Total</p>
                    <p className="mt-1 font-mono text-xl font-bold text-paper">R$ 4.850.000,00</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-acid">
                      <span>Execução: 42.8%</span>
                      <span>No prazo</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-void">
                      <div className="h-full rounded-full bg-acid" style={{ width: "42.8%" }} />
                    </div>
                  </div>
                  <div className="rounded-sm border border-shadow bg-panel p-4">
                    <p className="font-mono text-xs uppercase text-muted">Medido no Mês</p>
                    <p className="mt-1 font-mono text-xl font-bold text-paper">R$ 384.200,00</p>
                    <p className="mt-3 text-xs text-muted">Aprovado pelo cliente • 100%</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-void">
                      <div className="h-full rounded-full bg-acid" style={{ width: "100%" }} />
                    </div>
                  </div>
                  <div className="rounded-sm border border-shadow bg-panel p-4">
                    <p className="font-mono text-xs uppercase text-muted">Economia BDI / Insumos</p>
                    <p className="mt-1 font-mono text-xl font-bold text-acid">+ R$ 68.450,00</p>
                    <p className="mt-3 text-xs text-muted">Otimização de compras</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-void">
                      <div className="h-full rounded-full bg-purple-light" style={{ width: "85%" }} />
                    </div>
                  </div>
                  <div className="rounded-sm border border-shadow bg-panel p-4">
                    <p className="font-mono text-xs uppercase text-muted">Retenções Técnicas</p>
                    <p className="mt-1 font-mono text-xl font-bold text-paper">R$ 19.210,00</p>
                    <p className="mt-3 text-xs text-muted">5% garantia contratual</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-void">
                      <div className="h-full rounded-full bg-line" style={{ width: "50%" }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-sm border border-shadow bg-panel p-5">
                  <div className="flex items-center justify-between border-b border-shadow pb-3">
                    <span className="font-mono text-xs font-bold uppercase text-paper">
                      Últimos Lançamentos Vinculados ao Canteiro
                    </span>
                    <span className="font-mono text-xs text-acid">Sincronizado há 2 min ↗</span>
                  </div>
                  <div className="mt-3 divide-y divide-shadow font-mono text-xs">
                    <div className="flex flex-col justify-between gap-2 py-2.5 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-acid">01</span>
                        <span className="text-paper">Alvenaria de vedação blocos cerâmicos 14x19x29</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-muted">1.240 m²</span>
                        <span className="font-bold text-paper">R$ 104.408,00</span>
                        <span className="badge-acid">MEDIDO</span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between gap-2 py-2.5 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-acid">02</span>
                        <span className="text-paper">Concreto usinado bombeável fck=30 MPa</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-muted">180 m³</span>
                        <span className="font-bold text-paper">R$ 89.100,00</span>
                        <span className="badge-purple">LIBERADO</span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between gap-2 py-2.5 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-acid">03</span>
                        <span className="text-paper">Aço CA-50 d=10.0mm cortado e dobrado</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-muted">4.500 kg</span>
                        <span className="font-bold text-paper">R$ 57.600,00</span>
                        <span className="badge-acid">FATURADO</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "medicoes" && (
              <div className="space-y-4 font-mono text-xs">
                <div className="rounded-sm border border-shadow bg-panel p-5">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <span className="font-bold text-paper">Boletim de Medição #04 — Etapa Estrutural</span>
                    <span className="text-acid">Período: 01 a 15 do corrente</span>
                  </div>
                  <p className="mt-3 leading-relaxed text-muted">
                    Validação em 2 etapas com retenção técnica de 5% calculada automaticamente pelo sistema. Histórico completo auditável com exportação em PDF e planilha.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "sinapi" && (
              <div className="space-y-4 font-mono text-xs">
                <div className="rounded-sm border border-shadow bg-panel p-5">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <span className="font-bold text-paper">Base Oficial SINAPI — Caixa Econômica Federal</span>
                    <span className="text-purple-light">27 Unidades Federativas</span>
                  </div>
                  <p className="mt-3 leading-relaxed text-muted">
                    Composições analíticas e sintéticas com desoneração e sem desoneração atualizadas mensalmente. Precificação precisa para licitações e orçamentos executivos.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
function Plans() {
  const [cycle, setCycle] = useState("monthly");
  return (
    <div className="wrap py-16 md:py-24">
      <p className="eyebrow">Planos / Seu próximo passo</p>
      <h1 className="page-title">
        O plano certo.
        <br />
        <span className="text-acid">Para a sua obra.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted">
        Compare recursos, equipe e capacidade de obras. Escolha a estrutura que
        acompanha o momento da sua operação.
      </p>
      <div
        aria-label="Periodicidade de cobrança"
        className="my-12 flex flex-wrap items-center gap-2"
      >
        {Object.values(PLAN_BILLING_CYCLES).map((c) => (
          <button
            key={c.id}
            aria-pressed={cycle === c.id}
            onClick={() => setCycle(c.id)}
            className={`flex items-center gap-2 rounded-sm border px-5 py-3 text-sm transition-all duration-150 ${
              cycle === c.id
                ? "border-acid bg-acid font-bold text-void shadow-[0_2px_12px_rgba(198,255,0,0.25)]"
                : "border-line bg-void hover:border-acid hover:text-paper"
            }`}
          >
            <span>{c.label}</span>
            {c.discountPercent > 0 && (
              <span
                className={`rounded-xs px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  cycle === c.id
                    ? "bg-void text-acid"
                    : "bg-purple/20 text-purple-light"
                }`}
              >
                -{c.discountPercent}%
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {paid.map((id) => {
          const p = PLAN_RULES[id],
            price = PLAN_CYCLE_PRICING[id][cycle];
          return (
            <article
              key={id}
              className={`flex flex-col rounded-sm border p-7 transition-all duration-150 hover:-translate-y-1 ${
                id === "pro"
                  ? "border-acid bg-panel shadow-[0_4px_24px_rgba(198,255,0,0.12)]"
                  : "border-line bg-void hover:border-acid/40"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow mb-0">
                  {id === "pro"
                    ? "Para crescer com controle"
                    : id === "unlimited"
                      ? "Operações em escala"
                      : "Gestão de ponta a ponta"}
                </p>
                {id === "pro" && (
                  <span className="badge-acid">Mais Escolhido</span>
                )}
                {id === "unlimited" && (
                  <span className="badge-purple">SINAPI & BIM</span>
                )}
              </div>
              <h2 className="text-2xl font-bold">{p.label}</h2>
              <p className="mt-4 min-h-20 text-sm leading-relaxed text-muted">
                {p.idealFor}
              </p>
              <p className="mt-5 text-4xl font-bold tracking-tight">
                {money(price.monthlyEquivalentCents)}
                <span className="text-sm font-normal text-muted"> / mês</span>
              </p>
              <p className="mt-3 text-sm text-muted">
                {cycle === "monthly"
                  ? "Cobrança mensal, sem fidelidade"
                  : `${money(price.totalCents)} a cada ${price.months} meses`}
              </p>
              <p className="mt-3 min-h-6 text-sm text-acid font-medium">
                {price.savingsCents > 0
                  ? `Economize ${money(price.savingsCents)} no período`
                  : "Flexibilidade para começar"}
              </p>
              <ul className="my-8 space-y-4 border-t border-line pt-6 text-sm">
                <li>✓ {p.maxActiveObras ?? "Ilimitadas"} obras ativas</li>
                <li>
                  ✓ {p.maxUsers} {p.maxUsers === 1 ? "usuário" : "usuários"}
                </li>
                <li>✓ Financeiro e medições</li>
                <li>✓ Suporte {p.supportLevel.toLowerCase()}</li>
              </ul>
              <a
                className={
                  id === "pro" ? "action mt-auto" : "outline-action mt-auto"
                }
                href={`${contact}?text=${encodeURIComponent(`Olá! Quero conhecer o ${p.label} ${PLAN_BILLING_CYCLES[cycle].label} do FinGo.`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Escolher este plano ↗
              </a>
            </article>
          );
        })}
      </div>
      <section className="mt-20">
        <h2 className="mb-8 text-3xl font-bold">Compare os recursos</h2>
        <div
          className="overflow-x-auto rounded-sm border border-line"
          role="region"
          aria-label="Comparação de planos"
          tabIndex={0}
        >
          <table className="w-full min-w-150 text-left text-sm">
            <caption className="sr-only">
              Recursos incluídos em cada plano FinGo
            </caption>
            <thead>
              <tr className="bg-panel">
                <th className="p-5" scope="col">
                  Recurso
                </th>
                {paid.map((id) => (
                  <th key={id} scope="col" className="p-5">
                    {PLAN_RULES[id].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                "obras",
                "financeiro",
                "medicoes",
                "precompras",
                "contratos",
                "notas",
                "orcamentos",
                "assinatura",
              ].map((key) => (
                <tr className="border-t border-line" key={key}>
                  <th scope="row" className="p-5 font-normal">
                    {PLAN_MODULE_CATALOG[key]}
                  </th>
                  {paid.map((id) => (
                    <td key={id} className="p-5">
                      {PLAN_RULES[id].modules.includes(key)
                        ? "Incluído"
                        : "Não incluído"}
                    </td>
                  ))}
                </tr>
              ))}
              {[
                ["sinapi", "SINAPI"],
                ["engineering", "Engenharia"],
                ["advancedPermissions", "Permissões avançadas"],
              ].map(([key, label]) => (
                <tr className="border-t border-line" key={key}>
                  <th scope="row" className="p-5 font-normal">
                    {label}
                  </th>
                  {paid.map((id) => (
                    <td key={id} className="p-5">
                      {PLAN_RULES[id].features[key]
                        ? "Incluído"
                        : "Não incluído"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-16 max-w-3xl">
        <h2 className="mb-6 text-3xl font-bold">Antes de começar</h2>
        {[
          [
            "Posso conhecer o sistema antes de contratar?",
            <>
              Sim.{" "}
              <a href="/cadastro" className="text-acid underline">
                Crie sua conta para testar o FinGo por 15 dias
              </a>{" "}
              e conhecer os recursos disponíveis no período de avaliação.
            </>,
          ],
          [
            "Como funciona a cobrança por período?",
            "Nos ciclos trimestral, semestral e anual, o valor por mês é uma referência. O total do período está indicado em cada plano.",
          ],
          [
            "Qual plano inclui SINAPI e engenharia?",
            "Os recursos de SINAPI, engenharia e permissões avançadas estão incluídos no Construtora Ilimitado.",
          ],
        ].map(([q, a]) => (
          <details key={q} className="border-b border-line py-5">
            <summary className="font-bold">{q}</summary>
            <p className="mt-4 leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
function About() {
  return (
    <>
      <section className="wrap py-20 md:py-28">
        <p className="eyebrow">Sobre nós / O que nos move</p>
        <h1 className="page-title">
          Construir exige visão.
          <br />
          <span className="text-acid">Gerir também.</span>
        </h1>
        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <p className="text-2xl leading-relaxed">
            Nosso propósito é tornar a gestão da construção mais clara,
            conectada e próxima de quem faz a obra acontecer.
          </p>
          <p className="text-lg leading-relaxed text-muted">
            O FinGo é uma plataforma de gestão financeira e operacional para a
            construção civil. Reunimos rotinas de obras, custos, compras e
            medições em um só lugar, para ajudar profissionais e construtoras a
            acompanhar sua operação com mais contexto.
          </p>
        </div>
      </section>
      <div className="wrap">
        <img
          src="/img/fingo/construction-background.jpg"
          alt="Profissional com capacete acompanhando uma obra"
          className="h-72 w-full rounded-sm object-cover grayscale md:h-96"
        />
      </div>
      <section className="wrap py-24">
        <p className="eyebrow">Nossos objetivos</p>
        <div className="grid gap-10 md:grid-cols-3">
          {[
            [
              "01",
              "Aproximar canteiro e escritório",
              "Fazer a informação circular entre quem executa, quem acompanha e quem decide.",
            ],
            [
              "02",
              "Dar clareza à gestão",
              "Ajudar a entender os custos e acompanhar os compromissos de cada obra, com informações organizadas.",
            ],
            [
              "03",
              "Simplificar para evoluir",
              "Reduzir o trabalho repetitivo e desenvolver ferramentas úteis para a realidade da construção.",
            ],
          ].map(([n, t, d]) => (
            <article key={n} className="border-t border-acid pt-6">
              <p className="font-mono text-acid">{n} /</p>
              <h2 className="mb-5 mt-8 text-2xl font-bold">{t}</h2>
              <p className="leading-relaxed text-muted">{d}</p>
            </article>
          ))}
        </div>
        <div className="mt-20 flex flex-col items-start justify-between gap-8 border-t border-line pt-12 md:flex-row">
          <h2 className="font-display text-4xl uppercase">
            Sua próxima obra.
            <br />
            Um novo jeito de gerir.
          </h2>
          <a href="/planos" className="action">
            Conheça os planos ↗
          </a>
        </div>
      </section>
    </>
  );
}
function ManualsSection() {
  return (
    <section className="border-t border-shadow bg-ink py-20">
      <div className="wrap">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Aprenda a Operar // Documentação Oficial</p>
            <h2 className="font-display text-3xl uppercase md:text-5xl">
              Manuais Práticos: <span className="text-acid">Domine cada rotina</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              12 guias ilustrados passo a passo com telas do sistema, localização exata de cada botão no canteiro e instruções para gerar PDFs de treinamento para sua equipe.
            </p>
          </div>
          <a href="/manuais" className="action shrink-0">
            Ver todos os 12 manuais ↗
          </a>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              num: "01",
              title: "Início de Obra & Clientes",
              trilha: "Obras & Canteiro",
              desc: "Cadastre clientes, vincule contratos, prazos de entrega e estruture os centros de custo da obra.",
              id: "manual-1-inicio-obra",
            },
            {
              num: "04",
              title: "Medições & Retenções Técnicas",
              trilha: "Financeiro & Caixa",
              desc: "Boletins de medição com cálculo automático de 11% de INSS e 5% de ISS na fonte para empreiteiros.",
              id: "manual-4-medicoes-retencoes",
            },
            {
              num: "07",
              title: "Orçamentos SINAPI da Caixa",
              trilha: "Engenharia & SINAPI",
              desc: "Consultas das composições oficiais dos 27 estados, aplicação de BDI TCU e curvas ABC de insumos.",
              id: "manual-7-orcamento-sinapi",
            },
            {
              num: "12",
              title: "BIM 3D & Coordenação",
              trilha: "BIM 3D & Inovação",
              desc: "Visualizador IFC e modelos 3D no canteiro em tempo real para verificar compatibilização e projeto.",
              id: "manual-12-bim-viewer",
            },
          ].map((item) => (
            <div
              key={item.num}
              className="group flex flex-col justify-between rounded-sm border border-shadow bg-panel p-6 transition-all duration-150 hover:-translate-y-1 hover:border-acid/50"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-acid">GUIA {item.num} //</span>
                  <span className="badge-purple text-[10px]">{item.trilha}</span>
                </div>
                <h3 className="mt-4 font-bold text-lg text-paper group-hover:text-acid">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {item.desc}
                </p>
              </div>
              <div className="mt-6 border-t border-shadow pt-4">
                <a
                  href={`/manuais#${item.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-acid group-hover:underline"
                >
                  <span>Abrir manual ilustrado</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScreenSimulator({ manual, activeStep }) {
  const step = manual.passos[activeStep - 1] || manual.passos[0];
  const stepNum = activeStep;

  // Render contextual mock content based on manual.id and activeStep
  const getContextualView = () => {
    switch (manual.id) {
      case "manual-1-inicio-obra":
        if (stepNum === 1) {
          return (
            <div className="p-4 space-y-3">
              <div className="rounded border-2 border-dashed border-acid/80 bg-acid/10 p-4 text-center shadow-[0_0_15px_rgba(198,255,0,0.15)]">
                <span className="text-2xl">👈</span>
                <p className="font-bold text-acid text-xs mt-1 uppercase tracking-wide">
                  PASSO 1: Selecione "Obras & Clientes" no Menu Lateral
                </p>
                <p className="text-[11px] text-paper mt-1">
                  Clique no ícone de capacete na barra lateral esquerda para abrir o módulo.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 opacity-50 pointer-events-none">
                <div className="rounded bg-panel p-3 border border-shadow">
                  <span className="text-[10px] text-muted font-mono uppercase">Obras Ativas</span>
                  <p className="text-sm font-bold text-paper font-mono">12 canteiros</p>
                </div>
                <div className="rounded bg-panel p-3 border border-shadow">
                  <span className="text-[10px] text-muted font-mono uppercase">Contratos Caixa</span>
                  <p className="text-sm font-bold text-acid font-mono">R$ 18.450.000,00</p>
                </div>
              </div>
            </div>
          );
        }
        if (stepNum === 2) {
          return (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-shadow pb-3">
                <div>
                  <span className="text-xs font-bold text-paper">Canteiros de Obras Cadastrados</span>
                  <p className="text-[10px] text-muted">Gestão física e financeira da construtora</p>
                </div>
                <div className="relative">
                  <button className="pulse-beacon rounded bg-acid px-3.5 py-1.5 text-xs font-bold text-void flex items-center gap-1.5 shadow-[0_0_15px_rgba(198,255,0,0.4)]">
                    <span>+ Nova Obra</span>
                  </button>
                  <div className="absolute -top-7 right-0 rounded bg-acid text-void font-mono font-bold text-[9px] px-2 py-0.5 whitespace-nowrap shadow-lg animate-bounce">
                    👇 PASSO 2: CLIQUE AQUI
                  </div>
                </div>
              </div>
              <div className="space-y-2 opacity-40 pointer-events-none">
                <div className="flex items-center justify-between p-2.5 rounded bg-panel border border-shadow text-xs">
                  <span className="text-paper font-semibold">Edifício Horizon — Torre A</span>
                  <span className="badge-acid text-[9px]">42% CONCLUÍDO</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded bg-panel border border-shadow text-xs">
                  <span className="text-paper font-semibold">Residencial Jardins — Bloco B</span>
                  <span className="badge-purple text-[9px]">FUNDAÇÃO</span>
                </div>
              </div>
            </div>
          );
        }
        if (stepNum === 3) {
          return (
            <div className="p-3">
              <div className="rounded border-2 border-acid bg-[#141414] p-3.5 shadow-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-shadow pb-2">
                  <span className="text-xs font-bold text-acid uppercase tracking-wider">
                    Formulário: Cadastrar Nova Obra
                  </span>
                  <span className="badge-acid text-[9px]">PASSO 3: DADOS GERAIS</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] font-mono text-muted block mb-0.5">Nome da Obra *</label>
                    <div className="rounded border-2 border-acid bg-void px-2.5 py-1.5 text-paper font-mono text-xs shadow-[0_0_8px_rgba(198,255,0,0.2)]">
                      Residencial Jardins do Lago — Torre Sul
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-muted block mb-0.5">Cliente / Contratante *</label>
                      <div className="rounded border border-line bg-void px-2.5 py-1 text-silver font-mono text-[11px]">
                        Incorporadora Alpha Ltda
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-muted block mb-0.5">CPF / CNPJ *</label>
                      <div className="rounded border border-line bg-void px-2.5 py-1 text-silver font-mono text-[11px]">
                        12.345.678/0001-90
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted block mb-0.5">Responsável Técnico (CREA/CAU) *</label>
                    <div className="rounded border border-line bg-void px-2.5 py-1 text-silver font-mono text-[11px]">
                      Eng. Carlos Mendes — CREA 45912/D-RR
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        if (stepNum === 4) {
          return (
            <div className="p-3">
              <div className="rounded border-2 border-acid bg-[#141414] p-3.5 shadow-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-shadow pb-2">
                  <div className="flex gap-2">
                    <span className="text-xs text-muted">Dados Gerais</span>
                    <span className="text-xs font-bold text-acid border-b-2 border-acid pb-0.5">Prazos & Orçamento</span>
                  </div>
                  <span className="badge-acid text-[9px]">PASSO 4: METAS</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-mono text-muted block mb-0.5">Início da Obra *</label>
                    <div className="rounded border border-line bg-void px-2.5 py-1.5 text-paper font-mono text-xs">
                      01/10/2026
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted block mb-0.5">Entrega Prevista *</label>
                    <div className="rounded border border-line bg-void px-2.5 py-1.5 text-paper font-mono text-xs">
                      30/11/2027
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted block mb-0.5">Valor Contratado / Orçado (R$) *</label>
                  <div className="rounded border-2 border-acid bg-void px-2.5 py-1.5 text-acid font-mono font-bold text-sm shadow-[0_0_10px_rgba(198,255,0,0.25)]">
                    R$ 4.850.000,00
                  </div>
                  <span className="text-[10px] text-muted mt-1 block">Vinculado ao repasse Caixa Econômica / Financiamento</span>
                </div>
              </div>
            </div>
          );
        }
        if (stepNum === 5) {
          return (
            <div className="p-3 space-y-3">
              <div className="rounded border border-shadow bg-panel p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-shadow pb-2">
                  <span className="text-xs font-bold text-paper">Resumo Final da Obra</span>
                  <span className="badge-purple text-[9px]">PRONTO PARA ATIVAR</span>
                </div>
                <div className="rounded border border-acid/60 bg-acid/10 p-3 text-xs text-acid flex items-center gap-2.5">
                  <span className="text-lg">✅</span>
                  <div>
                    <strong className="block text-paper">Centro de Custo #OBR-042 Criado!</strong>
                    <span className="text-[11px]">Painel de evolução física e fluxo de caixa ativados.</span>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button className="pulse-beacon rounded bg-acid px-5 py-2.5 text-xs font-bold text-void flex items-center gap-2 shadow-[0_0_15px_rgba(198,255,0,0.4)]">
                    <span>💾 Salvar Obra</span>
                  </button>
                </div>
              </div>
              <div className="text-center">
                <span className="font-mono text-[10px] text-acid font-bold">🚀 PASSO 5: Clique em Salvar Obra para finalizar o cadastro</span>
              </div>
            </div>
          );
        }
        break;

      case "manual-4-medicoes-retencoes":
        if (stepNum === 1) {
          return (
            <div className="p-4 space-y-3">
              <div className="rounded border-2 border-dashed border-acid/80 bg-acid/10 p-4 text-center shadow-[0_0_15px_rgba(198,255,0,0.15)]">
                <span className="text-2xl">👈</span>
                <p className="font-bold text-acid text-xs mt-1 uppercase tracking-wide">
                  PASSO 1: Acesse "Medições & Faturamento" no Menu
                </p>
                <p className="text-[11px] text-paper mt-1">
                  Gerencie boletins de empreiteiros com cálculo automático de retenções tributárias.
                </p>
              </div>
            </div>
          );
        }
        if (stepNum === 2) {
          return (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-shadow pb-3">
                <div>
                  <span className="text-xs font-bold text-paper">Boletins de Medição</span>
                  <p className="text-[10px] text-muted">Controle de empreiteiros e repasses</p>
                </div>
                <div className="relative">
                  <button className="pulse-beacon rounded bg-acid px-3.5 py-1.5 text-xs font-bold text-void flex items-center gap-1.5 shadow-[0_0_15px_rgba(198,255,0,0.4)]">
                    <span>+ Nova Medição</span>
                  </button>
                  <div className="absolute -top-7 right-0 rounded bg-acid text-void font-mono font-bold text-[9px] px-2 py-0.5 whitespace-nowrap shadow-lg animate-bounce">
                    👇 PASSO 2: CLIQUE AQUI
                  </div>
                </div>
              </div>
            </div>
          );
        }
        if (stepNum === 3) {
          return (
            <div className="p-3 space-y-2">
              <div className="rounded border-2 border-acid bg-[#141414] p-3 text-xs space-y-2">
                <div className="flex justify-between border-b border-shadow pb-1.5">
                  <span className="font-bold text-paper">Lançamento de Quantitativos Medidos</span>
                  <span className="badge-acid text-[9px]">PASSO 3: SERVIÇOS</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-void text-[11px] font-mono border border-line">
                  <span className="text-paper">Alvenaria de vedação 14x19x29</span>
                  <span className="text-acid font-bold">1.240 m² = R$ 104.408,00</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-void text-[11px] font-mono border border-line">
                  <span className="text-paper">Concreto bombeável FCK 30 MPa</span>
                  <span className="text-acid font-bold">180 m³ = R$ 89.100,00</span>
                </div>
              </div>
            </div>
          );
        }
        if (stepNum === 4) {
          return (
            <div className="p-3 space-y-2">
              <div className="rounded border-2 border-acid bg-[#141414] p-3.5 text-xs space-y-2.5">
                <div className="flex justify-between border-b border-shadow pb-1.5">
                  <span className="font-bold text-acid">Aba: Retenções Tributárias na Fonte</span>
                  <span className="badge-purple text-[9px]">PASSO 4: TRIBUTOS</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="rounded bg-void p-2 border border-line">
                    <span className="text-muted block text-[9px]">INSS Cessão Mão de Obra (11%)</span>
                    <span className="text-paper font-bold">- R$ 11.484,88</span>
                  </div>
                  <div className="rounded bg-void p-2 border border-line">
                    <span className="text-muted block text-[9px]">ISSQN Municipal (5%)</span>
                    <span className="text-paper font-bold">- R$ 5.220,40</span>
                  </div>
                </div>
                <div className="rounded bg-void p-2.5 border border-acid flex justify-between font-mono text-xs shadow-[0_0_10px_rgba(198,255,0,0.2)]">
                  <span className="text-silver">Líquido a Pagar ao Empreiteiro:</span>
                  <span className="text-acid font-bold">R$ 87.702,72</span>
                </div>
              </div>
            </div>
          );
        }
        if (stepNum === 5) {
          return (
            <div className="p-3 space-y-3">
              <div className="rounded border border-shadow bg-panel p-4 space-y-3 text-center">
                <p className="text-xs text-paper font-bold">Espelho de Medição Formatado no Padrão Caixa Econômica</p>
                <div className="flex justify-center">
                  <button className="pulse-beacon rounded bg-acid px-5 py-2.5 text-xs font-bold text-void flex items-center gap-2 shadow-[0_0_15px_rgba(198,255,0,0.4)]">
                    <span>📄 Emitir Boletim de Medição (PDF)</span>
                  </button>
                </div>
                <p className="font-mono text-[10px] text-acid">🚀 PASSO 5: Gera o boletim oficial e provisiona guias no Contas a Pagar</p>
              </div>
            </div>
          );
        }
        break;

      default:
        // Generic high-craft simulator matching any of the 12 manuals
        if (stepNum === 1) {
          return (
            <div className="p-4 space-y-3">
              <div className="rounded border-2 border-dashed border-acid/80 bg-acid/10 p-4 text-center shadow-[0_0_15px_rgba(198,255,0,0.15)]">
                <span className="text-2xl">👈</span>
                <p className="font-bold text-acid text-xs mt-1 uppercase tracking-wide">
                  PASSO 1: Acesse {manual.modulo} no Menu Lateral
                </p>
                <p className="text-[11px] text-paper mt-1">
                  Clique no ícone destacado na barra esquerda para abrir a tela operacional.
                </p>
              </div>
              <div className="rounded bg-panel p-3 border border-shadow text-xs text-muted leading-relaxed">
                {manual.resumo}
              </div>
            </div>
          );
        }
        if (stepNum === 2) {
          return (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-shadow pb-3">
                <span className="text-xs font-bold text-paper">Módulo: {manual.modulo}</span>
                <div className="relative">
                  <button className="pulse-beacon rounded bg-acid px-3.5 py-1.5 text-xs font-bold text-void flex items-center gap-1.5 shadow-[0_0_15px_rgba(198,255,0,0.4)]">
                    <span>{step.titulo}</span>
                  </button>
                  <div className="absolute -top-7 right-0 rounded bg-acid text-void font-mono font-bold text-[9px] px-2 py-0.5 whitespace-nowrap shadow-lg animate-bounce">
                    👇 PASSO 2: CLIQUE AQUI
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted leading-relaxed">{step.desc}</p>
            </div>
          );
        }
        if (stepNum === 3) {
          return (
            <div className="p-3">
              <div className="rounded border-2 border-acid bg-[#141414] p-3.5 shadow-2xl space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-shadow pb-1.5">
                  <span className="font-bold text-acid uppercase">{step.titulo}</span>
                  <span className="badge-acid text-[9px]">PASSO 3: ENTRADA</span>
                </div>
                <p className="text-silver leading-relaxed">{step.desc}</p>
                <div className="rounded border border-dashed border-acid/50 bg-void p-2.5 font-mono text-[11px] text-acid">
                  🎯 Local exato da ação: {step.ondeExecutar}
                </div>
              </div>
            </div>
          );
        }
        if (stepNum === 4) {
          return (
            <div className="p-3">
              <div className="rounded border-2 border-acid bg-[#141414] p-3.5 shadow-2xl space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-shadow pb-1.5">
                  <span className="font-bold text-acid uppercase">{step.titulo}</span>
                  <span className="badge-purple text-[9px]">PASSO 4: REGRAS</span>
                </div>
                <p className="text-silver leading-relaxed">{step.desc}</p>
                <div className="rounded border border-line bg-void p-2.5 font-mono text-[11px] text-silver">
                  ⚙️ Parâmetros calculados automaticamente pelo FinGo OS v2.38
                </div>
              </div>
            </div>
          );
        }
        if (stepNum === 5) {
          return (
            <div className="p-3 space-y-3">
              <div className="rounded border border-shadow bg-panel p-4 space-y-3 text-center text-xs">
                <span className="text-xl">🎉</span>
                <p className="font-bold text-paper text-sm">{step.titulo}</p>
                <p className="text-muted leading-relaxed">{step.desc}</p>
                <div className="flex justify-center">
                  <button className="pulse-beacon rounded bg-acid px-5 py-2.5 text-xs font-bold text-void flex items-center gap-2 shadow-[0_0_15px_rgba(198,255,0,0.4)]">
                    <span>💾 Concluir Operação</span>
                  </button>
                </div>
                <p className="font-mono text-[10px] text-acid">🚀 PASSO 5: Rotina finalizada e vinculada ao canteiro!</p>
              </div>
            </div>
          );
        }
        break;
    }
  };

  const getActiveSidebarIcon = () => {
    const mod = manual.modulo.toLowerCase();
    if (mod.includes("obra") || mod.includes("cliente")) return "obras";
    if (mod.includes("medição") || mod.includes("medicao")) return "medicoes";
    if (mod.includes("financeiro") || mod.includes("caixa") || mod.includes("dre") || mod.includes("ofx")) return "financeiro";
    if (mod.includes("orçamento") || mod.includes("sinapi") || mod.includes("bdi")) return "sinapi";
    if (mod.includes("suprimento") || mod.includes("compra")) return "compras";
    if (mod.includes("nota") || mod.includes("nfe") || mod.includes("documento") || mod.includes("assinatura")) return "docs";
    if (mod.includes("bim")) return "bim";
    return "obras";
  };

  const activeModuleKey = getActiveSidebarIcon();

  return (
    <div className="rounded-sm border border-shadow bg-[#080808] overflow-hidden shadow-2xl">
      {/* Top Window Bar */}
      <div className="flex items-center justify-between border-b border-shadow bg-[#121212] px-3.5 py-2 select-none">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          <span className="ml-2 font-mono text-[11px] text-muted hidden sm:inline">
            FinGo OS v2.38 // Simulador de Interface
          </span>
        </div>
        <div className="rounded bg-void px-2.5 py-0.5 font-mono text-[10px] text-muted border border-shadow">
          https://fingo.api.br/app#{manual.id}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-acid animate-pulse" />
          <span className="font-mono text-[10px] text-acid font-bold">AO VIVO</span>
        </div>
      </div>

      {/* Simulated App Screen */}
      <div className="flex min-h-[350px]">
        {/* Sidebar */}
        <div className="w-14 shrink-0 border-r border-shadow bg-[#0d0d0d] p-2 flex flex-col items-center gap-3 select-none">
          <div className="h-6 w-6 rounded bg-acid text-void font-bold text-xs flex items-center justify-center font-display mb-1">
            F
          </div>
          <div className="w-full space-y-2">
            {[
              { id: "obras", icon: "🏗️", label: "Obras" },
              { id: "medicoes", icon: "📋", label: "Medições" },
              { id: "financeiro", icon: "💰", label: "Financeiro" },
              { id: "sinapi", icon: "📐", label: "SINAPI" },
              { id: "compras", icon: "🛒", label: "Compras" },
              { id: "docs", icon: "📄", label: "Docs" },
              { id: "bim", icon: "🧊", label: "BIM" },
            ].map((item) => {
              const isTargetModule = item.id === activeModuleKey;
              const isStep1 = stepNum === 1 && isTargetModule;
              return (
                <div
                  key={item.id}
                  title={item.label}
                  className={`relative h-8 w-8 rounded flex items-center justify-center text-sm transition-all ${
                    isStep1
                      ? "bg-acid text-void font-bold pulse-beacon shadow-[0_0_12px_rgba(198,255,0,0.6)]"
                      : isTargetModule
                      ? "bg-panel border border-acid/40 text-paper"
                      : "text-muted hover:text-paper"
                  }`}
                >
                  <span>{item.icon}</span>
                  {isStep1 && (
                    <div className="absolute left-10 z-30 rounded bg-acid text-void font-mono font-bold text-[9px] px-2 py-0.5 whitespace-nowrap shadow-lg">
                      👈 CLIQUE AQUI
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col bg-void">
          {/* Breadcrumb toolbar */}
          <div className="flex items-center justify-between border-b border-shadow bg-[#111111] px-4 py-2 text-xs select-none">
            <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
              <span>FinGo</span>
              <span>›</span>
              <span className="text-paper">{manual.modulo}</span>
              <span>›</span>
              <span className="text-acid">Passo 0{stepNum}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
              <span>Canteiro: Edifício Horizon</span>
              <span className="badge-purple text-[9px]">CONSTRUTORA ALPHA</span>
            </div>
          </div>

          {/* Contextual Screen View */}
          <div className="flex-1 flex flex-col justify-center">
            {getContextualView()}
          </div>

          {/* Status footer */}
          <div className="border-t border-shadow bg-[#0d0d0d] px-3.5 py-1.5 flex items-center justify-between font-mono text-[10px] text-muted select-none">
            <span>📍 Local: {step.ondeExecutar}</span>
            <span className="text-acid font-bold">Etapa 0{stepNum} / 05</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualsView() {
  const [selectedTrilha, setSelectedTrilha] = useState("todas");
  const [search, setSearch] = useState("");
  const [activeManual, setActiveManual] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [viewMode, setViewMode] = useState("interactive"); // "interactive" | "all"

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const found = MANUAIS.find((m) => m.id === hash);
      if (found) {
        setActiveManual(found);
        setActiveStep(1);
        setViewMode("interactive");
      }
    }
  }, []);

  // Keyboard navigation for steps
  useEffect(() => {
    function handleKeyDown(e) {
      if (!activeManual) return;
      if (e.key === "Escape") {
        setActiveManual(null);
      } else if (viewMode === "interactive") {
        if (e.key === "ArrowRight") {
          setActiveStep((s) => Math.min(5, s + 1));
        } else if (e.key === "ArrowLeft") {
          setActiveStep((s) => Math.max(1, s - 1));
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeManual, viewMode]);

  const filtered = MANUAIS.filter((m) => {
    const matchTrilha = selectedTrilha === "todas" || m.trilha === selectedTrilha;
    const query = search.trim().toLowerCase();
    const matchSearch =
      !query ||
      m.titulo.toLowerCase().includes(query) ||
      m.resumo.toLowerCase().includes(query) ||
      m.modulo.toLowerCase().includes(query) ||
      m.trilhaLabel.toLowerCase().includes(query);
    return matchTrilha && matchSearch;
  });

  const currentStep = activeManual ? activeManual.passos[activeStep - 1] || activeManual.passos[0] : null;

  return (
    <div className="py-16 md:py-24">
      {/* Header */}
      <section className="wrap mb-12">
        <p className="eyebrow">Documentação Oficial & Capacitação // FinGo</p>
        <h1 className="page-title">
          Manuais de <br />
          <span className="text-acid">Instrução do Sistema</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          12 guias práticos interativos com simulador visual de telas, localização exata de cada botão no canteiro e exportação para PDF técnico.
        </p>

        {/* Filtros e Busca */}
        <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {TRILHAS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTrilha(t.id)}
                className={`rounded-sm px-3.5 py-2 text-xs font-bold transition-all ${
                  selectedTrilha === t.id
                    ? "bg-acid text-void"
                    : "border border-shadow bg-panel text-muted hover:border-line hover:text-paper"
                }`}
              >
                <span className="mr-1.5">{t.icone}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="w-full md:w-72">
            <input
              type="search"
              placeholder="Buscar por módulo, rotina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-sm border border-line bg-panel px-4 py-2.5 text-xs text-paper placeholder:text-muted focus:border-acid focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Grade de Manuais */}
      <section className="wrap">
        {filtered.length === 0 ? (
          <div className="rounded-sm border border-shadow bg-panel p-12 text-center text-muted">
            Nenhum manual encontrado para a busca atual.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((manual) => (
              <article
                key={manual.id}
                id={manual.id}
                className="group flex flex-col justify-between rounded-sm border border-shadow bg-panel p-6 transition-all duration-150 hover:-translate-y-1 hover:border-acid/50"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-shadow pb-3">
                    <span className="font-mono text-xs font-bold text-acid">
                      MANUAL #{manual.numero}
                    </span>
                    <span className="badge-purple text-[10px]">
                      {manual.trilhaLabel}
                    </span>
                  </div>

                  <h2 className="mt-4 font-bold text-lg leading-snug text-paper group-hover:text-acid">
                    {manual.titulo}
                  </h2>

                  <div className="mt-3 flex items-center gap-3 text-xs text-muted font-mono">
                    <span>Módulo: <strong className="text-silver">{manual.modulo}</strong></span>
                    <span>•</span>
                    <span>⏱️ {manual.tempoLeitura}</span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-muted line-clamp-3">
                    {manual.resumo}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-3 border-t border-shadow pt-4">
                  <button
                    onClick={() => {
                      setActiveManual(manual);
                      setActiveStep(1);
                      setViewMode("interactive");
                    }}
                    className="action w-full text-xs py-2.5"
                  >
                    Abrir Manual Interativo ↗
                  </button>
                  <button
                    onClick={() => {
                      setActiveManual(manual);
                      setActiveStep(1);
                      setViewMode("all");
                      setTimeout(() => window.print(), 300);
                    }}
                    title="Imprimir ou Salvar em PDF"
                    className="outline-action px-3 py-2.5 text-xs text-silver shrink-0 hover:text-acid"
                  >
                    🖨️ PDF
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Modal Interativo do Manual */}
      {activeManual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveManual(null);
          }}
        >
          <div className="printable-card my-auto w-full max-w-5xl rounded-sm border border-shadow bg-[#101010] p-5 md:p-8 shadow-2xl">
            {/* Header do Modal */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-shadow pb-5 no-print">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge-acid font-mono text-xs">
                    MANUAL #{activeManual.numero}
                  </span>
                  <span className="badge-purple text-xs">
                    {activeManual.trilhaLabel}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    ⏱️ {activeManual.tempoLeitura} • Nível {activeManual.nivel}
                  </span>
                </div>
                <h2 className="mt-2.5 font-display text-xl uppercase md:text-3xl text-paper">
                  {activeManual.titulo}
                </h2>
                <p className="mt-1 text-xs font-mono text-acid">
                  MÓDULO DE EXECUÇÃO: {activeManual.modulo.toUpperCase()}
                </p>
              </div>

              {/* Seletor de Modo e Botões de Ação */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                <div className="flex rounded-sm border border-shadow bg-void p-0.5">
                  <button
                    onClick={() => setViewMode("interactive")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xs transition-all ${
                      viewMode === "interactive"
                        ? "bg-acid text-void"
                        : "text-muted hover:text-paper"
                    }`}
                  >
                    🎯 Modo Interativo
                  </button>
                  <button
                    onClick={() => setViewMode("all")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xs transition-all ${
                      viewMode === "all"
                        ? "bg-acid text-void"
                        : "text-muted hover:text-paper"
                    }`}
                  >
                    📋 Lista Completa
                  </button>
                </div>

                <button
                  onClick={() => window.print()}
                  className="outline-action px-3 py-1.5 text-xs text-acid inline-flex items-center gap-1.5"
                  title="Exportar ou Imprimir Manual em PDF"
                >
                  <span>🖨️ PDF</span>
                </button>
                <button
                  onClick={() => setActiveManual(null)}
                  className="outline-action px-3 py-1.5 text-xs"
                  title="Fechar (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* MODO 1: INTERATIVO GUIADO COM TELA SIMULADA */}
            {viewMode === "interactive" && (
              <div className="screen-only mt-6 space-y-6">
                {/* Stepper Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-acid font-bold">
                      PROGRESSO: PASSO 0{activeStep} DE 05
                    </span>
                    <span className="text-muted hidden sm:inline">
                      Dica: Use as setas [ ← ] e [ → ] do teclado para navegar
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                    {activeManual.passos.map((p) => {
                      const isCurrent = activeStep === p.num;
                      const isPassed = activeStep > p.num;
                      return (
                        <button
                          key={p.num}
                          onClick={() => setActiveStep(p.num)}
                          className={`flex flex-col text-left p-2 rounded transition-all cursor-pointer ${
                            isCurrent
                              ? "bg-acid text-void font-bold shadow-[0_0_12px_rgba(198,255,0,0.4)]"
                              : isPassed
                              ? "bg-panel border border-acid/40 text-paper"
                              : "bg-void border border-shadow text-muted hover:border-line"
                          }`}
                        >
                          <span className="font-mono text-[10px] uppercase">
                            0{p.num} {isPassed ? "✓" : ""}
                          </span>
                          <span className="truncate text-xs font-bold leading-snug">
                            {p.titulo}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid Split View: Instruções à Esquerda + Tela à Direita */}
                <div className="grid gap-6 lg:grid-cols-12 items-start">
                  {/* Coluna Esquerda: Instruções do Passo Ativo */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="rounded-sm border border-shadow bg-void p-5 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="badge-acid text-[10px]">
                          PASSO 0{activeStep} DE 05
                        </span>
                        <span className="font-mono text-[11px] text-muted">
                          {activeManual.modulo}
                        </span>
                      </div>

                      <h3 className="font-display text-xl uppercase text-paper leading-tight">
                        {currentStep.titulo}
                      </h3>

                      <p className="text-sm leading-relaxed text-silver">
                        {currentStep.desc}
                      </p>

                      {/* Pinpoint Action Box */}
                      <div className="rounded-sm border-2 border-acid/80 bg-acid/10 p-3 text-xs text-acid space-y-1 shadow-[0_0_15px_rgba(198,255,0,0.1)]">
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                          <span>🎯</span>
                          <span>Onde Executar no Sistema:</span>
                        </div>
                        <div className="font-mono text-paper font-bold text-xs">
                          {currentStep.ondeExecutar}
                        </div>
                      </div>

                      {/* Dica de Engenharia */}
                      {activeManual.dicaEngenharia && (
                        <div className="rounded-sm border border-purple/30 bg-purple/10 p-3 text-xs text-purple-light space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-paper text-[11px]">
                            <span>💡</span>
                            <span>Dica Prática de Engenharia:</span>
                          </div>
                          <p className="leading-relaxed text-[11px]">
                            {activeManual.dicaEngenharia}
                          </p>
                        </div>
                      )}

                      {/* Controles de Avanço do Passo */}
                      <div className="flex items-center gap-3 pt-3 border-t border-shadow">
                        <button
                          disabled={activeStep === 1}
                          onClick={() => setActiveStep((s) => Math.max(1, s - 1))}
                          className="outline-action w-full py-2.5 text-xs disabled:opacity-30 disabled:pointer-events-none"
                        >
                          ← Anterior
                        </button>
                        <button
                          disabled={activeStep === 5}
                          onClick={() => setActiveStep((s) => Math.min(5, s + 1))}
                          className="action w-full py-2.5 text-xs disabled:opacity-30 disabled:pointer-events-none"
                        >
                          Próximo Passo →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita: Simulador de Tela do Sistema */}
                  <div className="lg:col-span-7">
                    <ScreenSimulator manual={activeManual} activeStep={activeStep} />
                  </div>
                </div>
              </div>
            )}

            {/* MODO 2: LISTA COMPLETA DOS 5 PASSOS */}
            {viewMode === "all" && (
              <div className="screen-only mt-6 space-y-6">
                <div className="rounded-sm border border-shadow bg-void p-4 text-xs text-muted flex items-center justify-between">
                  <span>Visualização de todos os 5 passos do manual para consulta rápida.</span>
                  <span className="text-acid font-mono text-xs">Total: 5 passos</span>
                </div>
                <div className="space-y-4">
                  {activeManual.passos.map((p) => (
                    <div
                      key={p.num}
                      className="rounded-sm border border-shadow bg-void p-5 space-y-2.5 hover:border-acid/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="badge-acid text-xs">
                          PASSO 0{p.num}
                        </span>
                        <span className="font-mono text-xs text-acid">
                          📍 {p.ondeExecutar}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-paper">
                        {p.titulo}
                      </h3>
                      <p className="text-xs leading-relaxed text-silver">
                        {p.desc}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Simulador Geral */}
                <div className="mt-8">
                  <ScreenSimulator manual={activeManual} activeStep={3} />
                </div>
              </div>
            )}

            {/* MODO 3: FORMATAÇÃO EXECUTIVA PARA IMPRESSÃO / PDF */}
            <div className="print-only mt-4 space-y-6">
              <div className="border-b border-line pb-4">
                <div className="text-xs font-mono uppercase text-muted">
                  FinGo Tecnologia // Manual de Operação e Engenharia
                </div>
                <h1 className="text-2xl font-bold uppercase mt-1">
                  Manual #{activeManual.numero}: {activeManual.titulo}
                </h1>
                <p className="text-xs mt-1">
                  Módulo: <strong>{activeManual.modulo}</strong> • Trilha: {activeManual.trilhaLabel} • Nível: {activeManual.nivel}
                </p>
              </div>

              <div>
                <h2 className="text-sm font-bold uppercase mb-2">1. Objetivo Operacional</h2>
                <p className="text-xs leading-relaxed">{activeManual.resumo}</p>
              </div>

              <div>
                <h2 className="text-sm font-bold uppercase mb-2">2. Passo a Passo de Execução</h2>
                <table className="w-full text-xs text-left border border-line">
                  <thead>
                    <tr className="bg-panel">
                      <th className="p-2 border border-line">Passo</th>
                      <th className="p-2 border border-line">Ação</th>
                      <th className="p-2 border border-line">Descrição Detalhada</th>
                      <th className="p-2 border border-line">Onde Executar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeManual.passos.map((p) => (
                      <tr key={p.num} className="border-b border-line">
                        <td className="p-2 border border-line font-bold font-mono">0{p.num}</td>
                        <td className="p-2 border border-line font-bold">{p.titulo}</td>
                        <td className="p-2 border border-line">{p.desc}</td>
                        <td className="p-2 border border-line font-mono">{p.ondeExecutar}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activeManual.dicaEngenharia && (
                <div className="border border-line p-3 text-xs">
                  <strong>💡 Recomendação Técnica de Engenharia: </strong>
                  <span>{activeManual.dicaEngenharia}</span>
                </div>
              )}

              <div className="text-[10px] text-muted pt-4 border-t border-line flex justify-between">
                <span>Documento Oficial FinGo — https://fingo.api.br/manuais</span>
                <span>Impresso em: {new Date().toLocaleDateString("pt-BR")}</span>
              </div>
            </div>

            {/* Rodapé do Modal com Navegação entre Manuais */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-shadow pt-5 no-print">
              <div className="flex gap-2">
                {(() => {
                  const currentIndex = MANUAIS.findIndex((m) => m.id === activeManual.id);
                  const prevManual = currentIndex > 0 ? MANUAIS[currentIndex - 1] : null;
                  const nextManual = currentIndex < MANUAIS.length - 1 ? MANUAIS[currentIndex + 1] : null;
                  return (
                    <>
                      {prevManual && (
                        <button
                          onClick={() => {
                            setActiveManual(prevManual);
                            setActiveStep(1);
                          }}
                          className="outline-action px-3 py-2 text-xs"
                        >
                          ← Manual #{prevManual.numero}
                        </button>
                      )}
                      {nextManual && (
                        <button
                          onClick={() => {
                            setActiveManual(nextManual);
                            setActiveStep(1);
                          }}
                          className="outline-action px-3 py-2 text-xs"
                        >
                          Manual #{nextManual.numero} →
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="action text-xs py-2 px-4 inline-flex items-center gap-2"
                >
                  <span>Imprimir / Salvar em PDF</span>
                  <span>🖨️</span>
                </button>
                <button
                  onClick={() => setActiveManual(null)}
                  className="outline-action text-xs py-2 px-4"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlogView() {
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const found = ARTIGOS_BLOG.find((a) => a.slug === hash || a.id === hash);
      if (found) setSelectedArticle(found);
    }
  }, []);

  if (selectedArticle) {
    return (
      <article className="wrap py-16 md:py-24 max-w-4xl">
        <div className="mb-8">
          <button
            onClick={() => setSelectedArticle(null)}
            className="outline-action text-xs py-2 px-3 inline-flex items-center gap-1.5"
          >
            <span>← Voltar para todos os artigos</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="badge-acid">{selectedArticle.categoria}</span>
          <span className="font-mono text-xs text-muted">
            {selectedArticle.data} • ⏱️ {selectedArticle.tempoLeitura} de leitura
          </span>
        </div>

        <h1 className="font-display mt-6 text-3xl uppercase md:text-5xl leading-tight">
          {selectedArticle.titulo}
        </h1>

        <p className="mt-6 border-l-2 border-acid pl-4 text-lg italic text-silver leading-relaxed bg-panel/30 py-2">
          {selectedArticle.resumo}
        </p>

        <div className="mt-10 space-y-5 text-base leading-relaxed text-silver">
          {selectedArticle.conteudo.map((paragrafo, idx) => {
            const isFormula = paragrafo.startsWith("BDI =");
            const isBullet = paragrafo.startsWith("•") || paragrafo.startsWith("1.") || paragrafo.startsWith("2.");
            if (isFormula) {
              return (
                <div
                  key={idx}
                  className="rounded-sm border border-acid bg-void p-5 font-mono text-sm text-acid my-6 overflow-x-auto shadow-[0_0_15px_rgba(198,255,0,0.15)]"
                >
                  {paragrafo}
                </div>
              );
            }
            if (isBullet) {
              return (
                <div key={idx} className="font-mono text-xs bg-panel p-3 rounded-sm border border-shadow text-paper pl-4">
                  {paragrafo}
                </div>
              );
            }
            return (
              <p key={idx} className="text-muted leading-relaxed">
                {paragrafo}
              </p>
            );
          })}
        </div>

        {/* Banner de Conversão ao Fim do Artigo */}
        <div className="mt-14 rounded-sm border border-shadow bg-panel p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <span className="badge-purple">FinGo Engenharia & Gestão</span>
              <h3 className="font-display text-2xl uppercase mt-2 text-paper">
                Pronto para automatizar esses cálculos na sua construtora?
              </h3>
              <p className="text-xs text-muted mt-1 max-w-lg">
                O FinGo possui calculadora oficial de BDI TCU Acórdão 2622, tabelas SINAPI Caixa atualizadas e retenções automáticas de 11% INSS e 5% ISS em boletins de medição.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a href="/calculadora-bdi" className="outline-action text-xs">
                Calcular BDI Grátis ↗
              </a>
              <a href="/planos" className="action text-xs">
                Conhecer Planos ↗
              </a>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="py-16 md:py-24">
      <section className="wrap mb-14">
        <p className="eyebrow">Engenharia, Custos & Gestão de Obras // FinGo</p>
        <h1 className="page-title">
          Blog de <br />
          <span className="text-acid">Engenharia & Finanças</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Artigos técnicos aprofundados sobre orçamentos SINAPI da Caixa, cálculo de BDI pelo TCU, retenções em cessão de mão de obra e conciliação bancária na construção civil.
        </p>
      </section>

      <section className="wrap">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {ARTIGOS_BLOG.map((artigo) => (
            <article
              key={artigo.id}
              className="group flex flex-col justify-between rounded-sm border border-shadow bg-panel p-6 transition-all duration-150 hover:-translate-y-1 hover:border-acid/50"
            >
              <div>
                <div className="flex items-center justify-between border-b border-shadow pb-3">
                  <span className="badge-purple text-[10px]">
                    {artigo.categoria}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    ⏱️ {artigo.tempoLeitura}
                  </span>
                </div>

                <p className="mt-4 font-mono text-xs text-acid">
                  {artigo.data}
                </p>

                <h2 className="mt-2 font-bold text-lg leading-snug text-paper group-hover:text-acid">
                  {artigo.titulo}
                </h2>

                <p className="mt-3 text-xs leading-relaxed text-muted line-clamp-3">
                  {artigo.resumo}
                </p>
              </div>

              <div className="mt-6 border-t border-shadow pt-4">
                <button
                  onClick={() => setSelectedArticle(artigo)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-acid group-hover:underline"
                >
                  <span>Ler artigo completo</span>
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CookieNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("fingo_cookie_consent_v2"))
          ?.consented !== true
      );
    } catch {
      return true;
    }
  });
  if (!visible) return null;
  return (
    <aside
      aria-label="Cookies e privacidade"
      className="border-t border-line bg-panel pb-24"
    >
      <div className="wrap flex flex-col items-start gap-4 py-6 md:flex-row md:items-center md:justify-between">
        <p className="max-w-3xl text-sm text-muted">
          Usamos tecnologias essenciais ao funcionamento do FinGo. Consulte
          nossa{" "}
          <a className="text-acid underline" href="/privacidade">
            Política de Privacidade
          </a>{" "}
          e os{" "}
          <a className="text-acid underline" href="/termos">
            Termos de Uso
          </a>
          .
        </p>
        <button
          className="outline-action"
          onClick={() => {
            try {
              localStorage.setItem(
                "fingo_cookie_consent_v2",
                JSON.stringify({
                  consented: true,
                  timestamp: new Date().toISOString(),
                  version: "2.38",
                }),
              );
            } catch {}
            setVisible(false);
          }}
        >
          Entendi
        </button>
      </div>
    </aside>
  );
}

function App() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:p-4"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo">
        {current === "plans" ? (
          <Plans />
        ) : current === "about" ? (
          <About />
        ) : current === "manuais" ? (
          <ManualsView />
        ) : current === "blog" ? (
          <BlogView />
        ) : (
          <>
            <Home />
            <FeatureTour />
            <ManualsSection />
            <Faq />
            <Newsletter />
          </>
        )}
      </main>
      <Footer />
      <CookieNotice />
      <FinBot />
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
