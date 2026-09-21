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
const route = location.pathname.replace(/\/$|\.html$/g, "") || "/";
const current =
  route === "/planos" ? "plans" : route === "/sobre-nos" ? "about" : "home";
const contact = "https://wa.me/5595991363678";
const money = (cents) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paid = ["starter", "pro", "unlimited"];
function Header() {
  const [open, setOpen] = useState(false);
  const links = [
    ["/", "Início", "home"],
    ["/planos", "Planos", "plans"],
    ["/sobre-nos", "Sobre nós", "about"],
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
                id === current ? "text-acid" : "text-muted hover:text-paper"
              }
            >
              {label}
            </a>
          ))}
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
          className="wrap flex flex-col gap-5 pb-7 md:hidden"
        >
          {links.map(([url, label, id]) => (
            <a
              key={id}
              href={url}
              aria-current={id === current ? "page" : undefined}
            >
              {label}
            </a>
          ))}
          <a href="/login">Acessar o sistema ↗</a>
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
        ) : (
          <>
            <Home />
            <FeatureTour />
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
