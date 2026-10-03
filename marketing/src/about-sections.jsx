import React, { useEffect, useRef, useState } from "react";

// Seções interativas da página Sobre nós (/sobre-nos).
// Tudo funciona sem JavaScript na pré-renderização: o estado inicial já mostra
// o conteúdo completo; as animações só começam no navegador.

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ────────────────────────────────────────────────────────────────────────────
   1. Vídeo da obra com a mensagem principal
   ──────────────────────────────────────────────────────────────────────────── */

const PONTAS = [
  ["No canteiro", "Fotos, etapas e compras registradas pelo celular, na hora."],
  ["No escritório", "Custos, medições e caixa atualizados sem redigitar nada."],
  ["Na diretoria", "Orçado x realizado de cada obra para decidir com segurança."],
];

export function AboutVideoBand() {
  const boxRef = useRef(null);
  const videoRef = useRef(null);
  const [load, setLoad] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  // Só baixa o vídeo (7 MB) quando a seção chega perto da tela.
  useEffect(() => {
    if (prefersReducedMotion() || !("IntersectionObserver" in window) || !boxRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!load || !videoRef.current) return;
    videoRef.current.play().catch(() => {});
  }, [load]);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  return (
    <section className="wrap" aria-label="A obra e o escritório conectados">
      <div ref={boxRef} className="relative h-[26rem] overflow-hidden rounded-sm border border-shadow md:h-[34rem]">
        <img
          src="/img/fingo/construction-background.jpg"
          alt="Profissional de capacete acompanhando uma obra enquanto um drone registra o andamento"
          className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
          loading="lazy"
          decoding="async"
        />
        {load && !failed && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="auto"
            poster="/img/fingo/construction-background.jpg"
            aria-hidden="true"
            onError={() => setFailed(true)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
          >
            <source src="/img/fingo/construction-background.mp4" type="video/mp4" onError={() => setFailed(true)} />
          </video>
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-void via-void/55 to-void/0" />
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-acid" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-10">
          <div className="max-w-2xl">
            <p className="eyebrow mb-4">Do canteiro ao escritório</p>
            <p className="font-display text-3xl uppercase leading-[0.95] text-paper md:text-6xl">
              A obra acontece lá fora.
              <br />
              <span className="text-acid">O controle, em qualquer lugar.</span>
            </p>
          </div>
          {load && !failed && (
            <button
              type="button"
              onClick={toggle}
              className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-sm border border-paper/30 bg-void/60 px-4 font-mono text-xs uppercase tracking-widest text-paper transition-colors duration-150 hover:border-acid hover:text-acid md:self-auto"
              aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
            >
              <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
              {playing ? "Pausar" : "Reproduzir"}
            </button>
          )}
        </div>
      </div>

      <div className="grid border-x border-b border-shadow md:grid-cols-3">
        {PONTAS.map(([titulo, texto], i) => (
          <div
            key={titulo}
            className="border-t border-shadow p-6 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0"
          >
            <p className="font-mono text-xs text-acid">{String(i + 1).padStart(2, "0")} /</p>
            <p className="mt-3 text-lg font-bold text-paper">{titulo}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   2. Objetivos — seletor interativo com diagrama por objetivo
   ──────────────────────────────────────────────────────────────────────────── */

const OBJETIVOS = [
  {
    n: "01",
    title: "Aproximar canteiro e escritório",
    text: "Fazer a informação circular entre quem executa, quem acompanha e quem decide: fotos, etapas, compras e medições registradas na hora, pelo celular.",
    proof: ["Apontamentos com foto pelo celular", "Cronograma com semáforo de prazo", "Aviso no WhatsApp do responsável"],
    visual: "flow",
  },
  {
    n: "02",
    title: "Dar clareza aos números",
    text: "Mostrar o custo real de cada obra, comparar orçado e realizado e manter o fluxo de caixa batendo com o banco.",
    proof: ["Orçado x realizado por obra", "DRE gerencial", "Conciliação bancária por OFX"],
    visual: "bars",
  },
  {
    n: "03",
    title: "Simplificar para evoluir",
    text: "Eliminar digitação repetitiva com importação de NF-e, OFX e leitura de notas, para a equipe gastar tempo com a obra.",
    proof: ["Importação do XML da NF-e", "Extrato bancário por OFX", "Leitura automática de notas"],
    visual: "stack",
  },
  {
    n: "04",
    title: "Proteger a operação",
    text: "Dados de cada construtora isolados, acesso protegido, trilha de auditoria e tratamento de dados conforme a LGPD.",
    proof: ["Dados isolados por empresa", "Trilha de auditoria", "Tratamento conforme a LGPD"],
    visual: "shield",
  },
  {
    n: "05",
    title: "Falar a língua da engenharia",
    text: "Seguir as referências do setor: Acórdão 2.622/2013 do TCU, SINAPI da Caixa e as regras de retenção em medições.",
    proof: ["BDI pelo Acórdão 2.622/2013", "Composições SINAPI da Caixa", "Retenções de INSS e ISS"],
    visual: "grid",
  },
  {
    n: "06",
    title: "Crescer junto com o cliente",
    text: "Evoluir o sistema a partir das sugestões de quem usa no dia a dia, com planos que acompanham o tamanho da empresa.",
    proof: ["Planos por tamanho de empresa", "Sugestões viram melhorias", "Implantação acompanhada"],
    visual: "steps",
  },
];

function ObjetivoVisual({ kind }) {
  const common = {
    viewBox: "0 0 320 180",
    className: "objetivo-visual h-full w-full",
    "aria-hidden": "true",
    fill: "none",
  };
  switch (kind) {
    case "flow":
      return (
        <svg {...common}>
          <rect x="16" y="58" width="92" height="64" className="ov-box" />
          <rect x="212" y="58" width="92" height="64" className="ov-box" />
          <text x="62" y="94" className="ov-label" textAnchor="middle">CANTEIRO</text>
          <text x="258" y="94" className="ov-label" textAnchor="middle">ESCRITÓRIO</text>
          <path d="M108 78 H212" className="ov-flow" />
          <path d="M212 102 H108" className="ov-flow ov-flow-rev" />
          <rect x="150" y="70" width="16" height="16" className="ov-acid ov-travel" />
        </svg>
      );
    case "bars":
      return (
        <svg {...common}>
          {[
            [40, 90, 100],
            [110, 120, 112],
            [180, 70, 66],
            [250, 110, 128],
          ].map(([x, orc, real], i) => (
            <g key={x}>
              <rect x={x} y={160 - orc} width="18" height={orc} className="ov-box" />
              <rect
                x={x + 22}
                y={160 - real}
                width="18"
                height={real}
                className={`ov-grow ${real > orc ? "ov-danger" : "ov-acid"}`}
                style={{ animationDelay: `${i * 80}ms` }}
              />
            </g>
          ))}
          <path d="M24 160 H300" className="ov-axis" />
          <text x="24" y="20" className="ov-label">ORÇADO</text>
          <rect x="88" y="11" width="10" height="10" className="ov-acid" />
          <text x="104" y="20" className="ov-label">REALIZADO</text>
          <rect x="190" y="11" width="10" height="10" className="ov-danger" />
          <text x="206" y="20" className="ov-label">ACIMA</text>
        </svg>
      );
    case "stack":
      return (
        <svg {...common}>
          {["NF-E", "OFX", "NOTA"].map((label, i) => (
            <g key={label} className="ov-slide" style={{ animationDelay: `${i * 120}ms` }}>
              <rect x={24 + i * 10} y={36 + i * 34} width="96" height="28" className="ov-box" />
              <text x={34 + i * 10} y={55 + i * 34} className="ov-label">{label}</text>
            </g>
          ))}
          <path d="M150 90 H196" className="ov-flow" />
          <path d="M188 82 L198 90 L188 98" className="ov-axis" />
          <rect x="212" y="62" width="92" height="56" className="ov-acid-outline" />
          <text x="258" y="86" className="ov-label" textAnchor="middle">LANÇADO</text>
          <text x="258" y="104" className="ov-mono" textAnchor="middle">0 DIGITAÇÃO</text>
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={40 + i * 90} y="40" width="70" height="100" className="ov-box" />
          ))}
          {[0, 1, 2].map((i) => (
            <text key={i} x={75 + i * 90} y="96" className="ov-label" textAnchor="middle">
              EMPRESA {String.fromCharCode(65 + i)}
            </text>
          ))}
          <path d="M120 30 V150 M210 30 V150" className="ov-wall" />
          <rect x="68" y="52" width="14" height="14" className="ov-acid ov-pulse" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          {Array.from({ length: 8 }).map((_, i) => (
            <path key={`v${i}`} d={`M${30 + i * 38} 24 V156`} className="ov-axis ov-faint" />
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <path key={`h${i}`} d={`M30 ${24 + i * 44} H296`} className="ov-axis ov-faint" />
          ))}
          <text x="44" y="56" className="ov-mono">BDI</text>
          <text x="44" y="80" className="ov-big">TCU</text>
          <text x="44" y="98" className="ov-mono">ACÓRDÃO 2.622/2013</text>
          <text x="196" y="56" className="ov-mono">SINAPI</text>
          <text x="196" y="76" className="ov-label">REF. CAIXA</text>
          <text x="44" y="144" className="ov-mono">RETENÇÕES · INSS · ISS</text>
          <path d="M30 112 H296" className="ov-acid-line" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={36 + i * 66}
              y={140 - (i + 1) * 26}
              width="54"
              height={(i + 1) * 26}
              className={`ov-grow ${i === 3 ? "ov-acid" : "ov-box"}`}
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
          <path d="M24 140 H300" className="ov-axis" />
          <text x="36" y="164" className="ov-mono">INÍCIO</text>
          <text x="234" y="164" className="ov-mono">HOJE</text>
        </svg>
      );
  }
}

function ObjetivoPanel({ item }) {
  return (
    <div key={item.n} className="objetivo-panel">
      <div className="h-44 border-b border-shadow bg-void p-4 md:h-52">
        <ObjetivoVisual kind={item.visual} />
      </div>
      <div className="p-6 md:p-8">
        <p className="hidden font-mono text-sm text-acid lg:block">{item.n} /</p>
        <h3 className="mt-3 hidden font-display text-2xl uppercase leading-tight text-paper md:text-3xl lg:block">
          {item.title}
        </h3>
        <p className="leading-relaxed text-silver lg:mt-4">{item.text}</p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-muted">
          Como isso aparece no FinGo
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {item.proof.map((p) => (
            <li key={p} className="border-l-2 border-acid bg-panel px-3 py-2 text-sm text-paper">
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AboutObjectives() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef([]);

  function onKeyDown(event) {
    const last = OBJETIVOS.length - 1;
    let next = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = active === last ? 0 : active + 1;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="border-y border-shadow bg-ink py-24" aria-labelledby="objetivos-title">
      <div className="wrap">
        <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Nossos objetivos</p>
            <h2 id="objetivos-title" className="font-display text-3xl uppercase leading-tight md:text-5xl">
              Seis compromissos.
              <br />
              <span className="text-acid">Um sistema.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted">
            Escolha um objetivo para ver como ele vira recurso dentro do FinGo.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div role="tablist" aria-orientation="vertical" aria-label="Objetivos do FinGo" onKeyDown={onKeyDown} className="flex flex-col">
            {OBJETIVOS.map((item, index) => {
              const selected = active === index;
              return (
                <div key={item.n}>
                  <button
                    ref={(el) => (tabRefs.current[index] = el)}
                    type="button"
                    role="tab"
                    id={`objetivo-tab-${item.n}`}
                    aria-selected={selected}
                    aria-controls={`objetivo-panel-${item.n}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(index)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setActive(index)}
                    className={`objetivo-tab group flex w-full items-center gap-5 border-t border-shadow py-5 pl-4 pr-3 text-left transition-colors duration-150 ${
                      selected ? "is-active bg-panel" : "hover:bg-panel/60"
                    }`}
                  >
                    <span className={`font-mono text-sm ${selected ? "text-acid" : "text-muted"}`}>{item.n}</span>
                    <span className={`flex-1 text-lg font-bold md:text-xl ${selected ? "text-paper" : "text-silver"}`}>
                      {item.title}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`font-mono text-acid transition-transform duration-150 ${selected ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:opacity-60"}`}
                    >
                      →
                    </span>
                  </button>
                  {/* Celular: o painel abre logo abaixo do objetivo escolhido */}
                  {selected && (
                    <div className="mb-4 border border-shadow bg-ink lg:hidden">
                      <ObjetivoPanel item={item} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`objetivo-panel-${OBJETIVOS[active].n}`}
            aria-labelledby={`objetivo-tab-${OBJETIVOS[active].n}`}
            className="hidden self-start border border-shadow bg-ink lg:sticky lg:top-24 lg:block"
          >
            <ObjetivoPanel item={OBJETIVOS[active]} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   3. Suporte — conversa ilustrativa + status do atendimento em tempo real
   ──────────────────────────────────────────────────────────────────────────── */

const CONVERSA = [
  { from: "cliente", text: "Como lanço a medição nº 8 com retenção de INSS?" },
  { from: "suporte", text: "Na obra, abra Medições → Nova medição. A retenção de INSS é calculada e o valor líquido aparece no resumo." },
  { from: "cliente", text: "Apareceu o valor líquido certinho. Valeu!" },
  { from: "suporte", text: "Perfeito. Qualquer dúvida, é só chamar por aqui." },
];

// Atendimento humano: segunda a sexta, 08h–20h, horário de Brasília.
function atendimentoAberto(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    return !["Sat", "Sun"].includes(weekday) && hour >= 8 && hour < 20;
  } catch {
    return null;
  }
}

export function SupportChatVisual() {
  const ref = useRef(null);
  const [shown, setShown] = useState(CONVERSA.length);
  const [typing, setTyping] = useState(false);
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    setAberto(atendimentoAberto());
    const timer = setInterval(() => setAberto(atendimentoAberto()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion() || !("IntersectionObserver" in window) || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    if (box.top < window.innerHeight) return; // já visível: mantém a conversa completa
    setShown(0);
    const timers = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        CONVERSA.forEach((msg, i) => {
          const at = 500 + i * 1500;
          if (msg.from === "suporte") timers.push(setTimeout(() => setTyping(true), at - 900));
          timers.push(
            setTimeout(() => {
              setTyping(false);
              setShown(i + 1);
            }, at),
          );
        });
      },
      { threshold: 0.4 },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div ref={ref} className="support-visual relative overflow-hidden rounded-sm border border-shadow bg-void">
      <div aria-hidden="true" className="support-visual-grid absolute inset-0" />
      <div className="relative flex items-center justify-between border-b border-shadow px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-sm bg-acid font-display text-sm text-void">FG</span>
          <div>
            <p className="text-sm font-bold text-paper">Suporte FinGo</p>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Chat dentro do sistema</p>
          </div>
        </div>
        {aberto !== null && (
          <span
            className={`inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest ${
              aberto ? "border-acid/40 text-acid" : "border-line text-muted"
            }`}
          >
            <span className={`h-2 w-2 ${aberto ? "bg-acid pulse-beacon" : "bg-muted"}`} />
            {aberto ? "Equipe online" : "FinBot de plantão"}
          </span>
        )}
      </div>

      <ol className="relative flex min-h-[19rem] flex-col gap-3 px-5 py-6" aria-label="Exemplo de atendimento">
        {CONVERSA.slice(0, shown).map((msg, i) => (
          <li
            key={i}
            className={`support-msg max-w-[85%] rounded-sm px-4 py-3 text-sm leading-relaxed ${
              msg.from === "cliente"
                ? "self-end border border-line bg-panel text-paper"
                : "self-start border border-acid/30 bg-acid/10 text-paper"
            }`}
          >
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted">
              {msg.from === "cliente" ? "Você" : "Equipe FinGo"}
            </span>
            {msg.text}
          </li>
        ))}
        {typing && (
          <li className="self-start rounded-sm border border-acid/30 bg-acid/10 px-4 py-3" aria-label="Equipe digitando">
            <span className="support-typing" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </li>
        )}
      </ol>

      <div className="relative grid grid-cols-3 border-t border-shadow text-center">
        {[
          ["Chat", "no sistema"],
          ["WhatsApp", "(95) 99136-3678"],
          ["E-mail", "contato@fingo.api.br"],
        ].map(([a, b]) => (
          <div key={a} className="border-r border-shadow px-2 py-3 last:border-r-0">
            <p className="text-xs font-bold text-paper">{a}</p>
            <p className="truncate font-mono text-[10px] text-muted">{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
