"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import type { VerifyResponse } from "./api/verify/route";

// ─────────────────────────────────────────────────────────────
// Tipos locais
// ─────────────────────────────────────────────────────────────
interface HistoryEntry {
  id: string;
  input: string;
  result: VerifyResponse;
}

// ─────────────────────────────────────────────────────────────
// Constantes de UX
// ─────────────────────────────────────────────────────────────
const LOADING_STEPS = [
  "Consultando Agência Lupa...",
  "Verificando padrões linguísticos...",
  "Consultando Aos Fatos...",
  "Analisando credibilidade da fonte...",
  "Consultando AFP Checamos...",
  "Calculando Score de Confiabilidade...",
  "Compilando análise final...",
];

const STORAGE_KEY = "evidentia_history";
const MAX_HISTORY = 20;

// ─────────────────────────────────────────────────────────────
// Helpers visuais
// ─────────────────────────────────────────────────────────────
function getVerdictConfig(verdict: VerifyResponse["verdict"]) {
  switch (verdict) {
    case "verified":
      return {
        label: "Verificada",
        emoji: "✅",
        cssClass: "verdict-badge--verified",
        dotColor: "#4E8039",
        scoreColor: "#4E8039",
        title: "Informação Verificada",
      };
    case "inconclusive":
      return {
        label: "Inconclusiva",
        emoji: "⚠️",
        cssClass: "verdict-badge--inconclusive",
        dotColor: "#B07D1A",
        scoreColor: "#B07D1A",
        title: "Informação Inconclusiva",
      };
    case "false":
      return {
        label: "Potencialmente Falsa",
        emoji: "❌",
        cssClass: "verdict-badge--false",
        dotColor: "#C0392B",
        scoreColor: "#C0392B",
        title: "Potencialmente Falsa",
      };
  }
}

function getScoreColor(score: number) {
  if (score >= 65) return "#4E8039";
  if (score >= 35) return "#B07D1A";
  return "#C0392B";
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, max = 70) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ─────────────────────────────────────────────────────────────
// Score Gauge SVG
// ─────────────────────────────────────────────────────────────
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="score-gauge">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="var(--clr-border)"
          strokeWidth="8"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="score-gauge__value">
        {score}
        <span className="score-gauge__label">/ 100</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Loading State Component
// ─────────────────────────────────────────────────────────────
function LoadingState() {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((i) => (i + 1) % LOADING_STEPS.length);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-state animate-fadeIn">
      <div className="loading-spinner" />
      <p className="loading-title">Analisando informação…</p>
      <p className="loading-step">{LOADING_STEPS[stepIdx]}</p>
      <div className="loading-progress">
        <div className="loading-progress__dot" />
        <div className="loading-progress__dot" />
        <div className="loading-progress__dot" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Result Card Component
// ─────────────────────────────────────────────────────────────
function ResultCard({
  result,
  onNewCheck,
}: {
  result: VerifyResponse;
  onNewCheck: () => void;
}) {
  const config = getVerdictConfig(result.verdict);
  const color = getScoreColor(result.score);

  return (
    <div className="result-card animate-fadeUp">
      <div className="result-card__header">
        <ScoreGauge score={result.score} color={color} />
        <div className="result-card__verdict">
          <span className={`verdict-badge ${config.cssClass}`}>
            {config.emoji} {config.label}
          </span>
          <h2 className="result-card__title">{config.title}</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--clr-text-muted)" }}>
            Score de Confiabilidade: <strong style={{ color }}>{result.score}/100</strong>
          </p>
        </div>
      </div>

      <div className="result-card__body">
        {/* Análise */}
        <div className="result-section">
          <p className="result-section__title">📋 Análise</p>
          <p className="result-section__text">{result.summary}</p>
        </div>

        <div className="divider" />

        {/* Indicadores */}
        {result.flags.length > 0 && (
          <div className="result-section">
            <p className="result-section__title">🔍 Indicadores Detectados</p>
            <div className="flag-list">
              {result.flags.map((flag, i) => {
                const cls = flag.startsWith("✓")
                  ? ""
                  : flag.includes("⚠")
                  ? "flag-item--warning"
                  : "flag-item--danger";
                return (
                  <div key={i} className={`flag-item ${cls}`}>
                    {flag}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="divider" />

        {/* Fontes consultadas */}
        <div className="result-section">
          <p className="result-section__title">🏛️ Agências de Checagem Consultadas</p>
          <div className="source-list">
            {result.sources.map((src) => (
              <span key={src} className="source-chip">
                ✓ {src}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="result-card__footer">
        <span className="result-card__timestamp">
          Analisado em {formatDate(result.analyzedAt)}
        </span>
        <button className="btn btn-primary" onClick={onNewCheck} id="btn-nova-verificacao">
          + Nova Verificação
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// History Section Component
// ─────────────────────────────────────────────────────────────
function HistorySection({
  history,
  onSelect,
  onClear,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <section className="history-section" id="historico">
        <div className="history-header">
          <div>
            <h2 className="section-title">Histórico de Verificações</h2>
            <p className="section-subtitle">Suas verificações anteriores aparecerão aqui.</p>
          </div>
        </div>
        <div className="history-empty">
          <div className="history-empty__icon">📂</div>
          <p>Nenhuma verificação realizada ainda.</p>
          <p style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
            Suas análises são salvas localmente no seu navegador.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="history-section" id="historico">
      <div className="history-header">
        <div>
          <h2 className="section-title">Histórico de Verificações</h2>
          <p className="section-subtitle">
            {history.length} verificação{history.length !== 1 ? "ões" : ""} salva
            {history.length !== 1 ? "s" : ""} localmente
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onClear}
          id="btn-limpar-historico"
        >
          🗑 Limpar histórico
        </button>
      </div>
      <div className="history-list">
        {history.map((entry) => {
          const config = getVerdictConfig(entry.result.verdict);
          return (
            <button
              key={entry.id}
              className="history-item"
              onClick={() => onSelect(entry)}
              id={`history-item-${entry.id}`}
            >
              <div
                className="history-item__verdict-dot"
                style={{ background: config.dotColor }}
              />
              <div className="history-item__text">
                <div className="history-item__input">
                  {truncate(entry.input, 80)}
                </div>
                <div className="history-item__meta">
                  {config.emoji} {config.label} · {formatDate(entry.result.analyzedAt)}
                </div>
              </div>
              <div
                className="history-item__score"
                style={{ color: config.dotColor }}
              >
                {entry.result.score}/100
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// How It Works Section
// ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      number: "1",
      icon: "📝",
      title: "Envie a informação",
      desc: "Cole um link, título de notícia ou trecho de texto que deseja verificar. Aceita qualquer formato.",
    },
    {
      number: "2",
      icon: "🤖",
      title: "Análise por IA",
      desc: "Nosso sistema consulta agências de fact-checking e analisa padrões linguísticos e de credibilidade da fonte.",
    },
    {
      number: "3",
      icon: "📊",
      title: "Receba o Score",
      desc: "Você recebe um Score de Confiabilidade de 0 a 100 com veredito: Verificada, Inconclusiva ou Potencialmente Falsa.",
    },
  ];

  return (
    <section className="how-it-works" id="como-funciona">
      <div className="how-it-works__inner">
        <h2 className="section-title">Como funciona?</h2>
        <p className="section-subtitle">
          Três etapas simples para combater a desinformação.
        </p>
        <div className="steps-grid">
          {steps.map((step) => (
            <div key={step.number} className="step-card animate-fadeUp">
              <div className="step-card__number">{step.number}</div>
              <div className="step-card__icon">{step.icon}</div>
              <h3 className="step-card__title">{step.title}</h3>
              <p className="step-card__desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────
type PageState = "idle" | "loading" | "result";

export default function Home() {
  const [input, setInput] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  // Carrega histórico do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  // Salva histórico no localStorage
  const saveToHistory = useCallback((inputText: string, res: VerifyResponse) => {
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      input: inputText,
      result: res,
    };
    setHistory((prev) => {
      const updated = [entry, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const handleVerify = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 3) return;

    setError(null);
    setPageState("loading");

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Erro ao processar a análise.");
      }

      const data: VerifyResponse = await res.json();
      setResult(data);
      setPageState("result");
      saveToHistory(trimmed, data);

      // Scroll suave para o resultado
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setPageState("idle");
    }
  }, [input, saveToHistory]);

  const handleNewCheck = useCallback(() => {
    setPageState("idle");
    setResult(null);
    setInput("");
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    setInput(entry.input);
    setResult(entry.result);
    setPageState("result");
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleVerify();
      }
    },
    [handleVerify]
  );

  const charCount = input.length;
  const isOverLimit = charCount > 5000;
  const canSubmit = !isOverLimit && charCount >= 3 && pageState !== "loading";

  return (
    <>
      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <header className="navbar">
        <div className="navbar__inner">
          <Image
            src="/assets/logo.png"
            alt="Evidentia"
            width={140}
            height={28}
            className="navbar__logo"
            priority
          />
          <span className="navbar__badge">Verificador de Notícias</span>
        </div>
      </header>

      <main className="main">
        {/* ── HERO ───────────────────────────────────────────── */}
        <section className="hero animate-fadeUp">
          <div className="hero__eyebrow">Combate à Desinformação</div>
          <h1 className="hero__title">
            Verifique notícias com{" "}
            <span>Inteligência Artificial</span>
          </h1>
          <p className="hero__subtitle">
            Cole um link, título ou trecho de texto. O Evidentia analisa a
            credibilidade da informação e retorna um Score de Confiabilidade
            baseado em múltiplos critérios de fact-checking.
          </p>
        </section>

        {/* ── INPUT / LOADING / RESULTADO ────────────────────── */}
        <div
          className="main__section"
          style={{ paddingTop: 0 }}
          ref={resultRef}
        >
          {pageState === "idle" && (
            <div className="input-card animate-fadeUp delay-100">
              <label htmlFor="news-input" className="input-card__label">
                Insira a informação a verificar
              </label>
              <textarea
                id="news-input"
                className="input-card__textarea"
                placeholder="Cole aqui um link de notícia, um título ou um trecho de texto...&#10;&#10;Exemplos:&#10;• https://g1.globo.com/...&#10;• Vacina causa microchip, diz estudo&#10;• Texto completo de uma publicação suspeita"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={6}
                maxLength={5100}
                aria-describedby="input-hint"
              />
              <div className="input-card__footer">
                <span
                  className="input-card__hint"
                  id="input-hint"
                  style={{ color: isOverLimit ? "var(--clr-false)" : undefined }}
                >
                  💡 Aceita links, títulos ou textos · Ctrl+Enter para enviar ·{" "}
                  <span style={{ marginLeft: 4 }}>
                    {charCount}/5000
                  </span>
                </span>
                <button
                  id="btn-verificar"
                  className="btn btn-primary"
                  onClick={handleVerify}
                  disabled={!canSubmit}
                >
                  🔍 Verificar
                </button>
              </div>
              {error && (
                <p
                  style={{
                    marginTop: "0.75rem",
                    color: "var(--clr-false)",
                    fontSize: "0.87rem",
                    padding: "0.5rem 0.75rem",
                    background: "var(--clr-false-bg)",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  ⚠ {error}
                </p>
              )}
            </div>
          )}

          {pageState === "loading" && <LoadingState />}

          {pageState === "result" && result && (
            <ResultCard result={result} onNewCheck={handleNewCheck} />
          )}
        </div>

        {/* ── COMO FUNCIONA ──────────────────────────────────── */}
        <HowItWorks />

        {/* ── HISTÓRICO ──────────────────────────────────────── */}
        <HistorySection
          history={history}
          onSelect={handleSelectHistory}
          onClear={clearHistory}
        />
      </main>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer__inner">
          <Image
            src="/assets/logo.png"
            alt="Evidentia"
            width={110}
            height={22}
            className="footer__logo"
          />
          <div className="footer__text">
            <p>
              Evidentia — Sistema de Verificação de Fake News com Inteligência Artificial.
            </p>
            <p className="footer__disclaimer">
              ⚠ Esta é uma ferramenta de apoio. O score é baseado em análise
              heurística e não substitui a verificação humana qualificada. Sempre
              consulte fontes primárias antes de compartilhar qualquer informação.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}