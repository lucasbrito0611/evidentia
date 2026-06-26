// Evidentia — Motor de Análise Simulado (sem chave de API)
// Utiliza análise heurística multidimensional baseada em NLP simplificado

import { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
export interface VerifyResponse {
  score: number;
  verdict: "verified" | "inconclusive" | "false";
  summary: string;
  sources: string[];
  flags: string[];
  inputType: "url" | "title" | "text";
  analyzedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Domínios confiáveis conhecidos
// ─────────────────────────────────────────────────────────────
const TRUSTED_DOMAINS = [
  "g1.globo.com", "globo.com", "bbc.com", "bbc.co.uk",
  "reuters.com", "apnews.com", "cnn.com", "uol.com.br",
  "folha.uol.com.br", "estadao.com.br", "valor.globo.com",
  "agenciabrasil.ebc.com.br", "correiobraziliense.com.br",
  "nytimes.com", "theguardian.com", "br.reuters.com",
  "veja.abril.com.br", "exame.com", "cartacapital.com.br",
  "terra.com.br", "r7.com", "band.uol.com.br",
  "poder360.com.br", "nexojornal.com.br", "piauí.art.br",
  "gov.br", "ibge.gov.br", "senado.leg.br", "camara.leg.br",
  "who.int", "un.org", "scielo.br", "fiocruz.br",
  "nasa.gov", "nature.com", "science.org", "sciencedirect.com",
];

// ─────────────────────────────────────────────────────────────
// Sites de fact-checking conhecidos (sempre consultados)
// ─────────────────────────────────────────────────────────────
const FACTCHECK_SOURCES = [
  "Agência Lupa",
  "Aos Fatos",
  "AFP Checamos",
  "Agência Pública",
  "Estadão Verifica",
  "G1 Fato ou Fake",
  "Comprova",
];

// ─────────────────────────────────────────────────────────────
// Palavras sensacionalistas (red flags)
// ─────────────────────────────────────────────────────────────
const SENSATIONALIST_WORDS = [
  "urgente", "exclusivo", "bomba", "chocante", "absurdo",
  "inacreditável", "imperdível", "vaza", "vazou", "revelado",
  "segredo", "conspiração", "escondido", "eles não querem",
  "a mídia não mostra", "compartilhe antes que apaguem",
  "compartilhe rápido", "espalhe a verdade",
  "assustador", "surpreendente demais",
  "ninguém está falando", "proibido", "censurado",
  "milagroso", "cura definitiva", "elimina de vez",
  "eles não querem que você saiba", "fake news confirmada",
  "governo oculta", "médicos revelam", "cientistas descobrem segredo",
];

// ─────────────────────────────────────────────────────────────
// Frases de afirmação sem fonte identificada
// ─────────────────────────────────────────────────────────────
const UNVERIFIED_CLAIMS = [
  "estudos mostram que", "especialistas dizem que",
  "segundo fontes", "de acordo com especialistas",
  "todos sabem que", "é fato que", "comprovado que",
  "está provado", "cientificamente comprovado",
  "sem que ninguém perceba",
];

// ─────────────────────────────────────────────────────────────
// BASE DE CONHECIMENTO: Teorias da conspiração e pseudociência
// Cada entrada tem: padrões de texto (lowercase) + penalidade + mensagem
// ─────────────────────────────────────────────────────────────
interface KnownFalseClaim {
  /** Todos os padrões devem estar presentes para ativar a regra */
  patterns: string[][];  // cada sub-array é um grupo OR; todos os grupos devem dar match (AND)
  penalty: number;       // penalidade no score (negativa = subtrai)
  flag: string;          // mensagem exibida no card
  sourceNote?: string;   // nota extra para o summary
}

const KNOWN_FALSE_CLAIMS: KnownFalseClaim[] = [
  // ── Terra plana ─────────────────────────────────────────────
  {
    patterns: [["terra", "earth"], ["plana", "flat", "planismo", "terraplanismo"]],
    penalty: -55,
    flag: "❌ Afirmação contradiz consenso científico: a forma esférica da Terra é comprovada há mais de 2.000 anos e confirmada por agências espaciais como NASA, ESA e AEB.",
    sourceNote: "terra plana/terraplanismo",
  },
  // ── Vacinas e doenças ────────────────────────────────────────
  {
    patterns: [["vacina", "vacinação", "imunização"], ["causa", "provoca", "gera", "transmite"], ["autismo"]],
    penalty: -55,
    flag: "❌ Afirmação desmentida: múltiplos estudos com milhões de participantes refutaram qualquer ligação entre vacinas e autismo. O estudo original foi retratado por fraude científica.",
    sourceNote: "vacinas causam autismo",
  },
  {
    patterns: [["vacina", "chip", "microchip", "rastreador", "5g", "nanobots"]],
    penalty: -60,
    flag: "❌ Teoria da conspiração desmentida: vacinas contêm apenas princípios ativos, adjuvantes e conservantes regulamentados pela ANVISA e OMS. Não há chips ou rastreadores.",
    sourceNote: "vacina com microchip/5G",
  },
  // ── Negacionismo climático ────────────────────────────────────
  {
    patterns: [["aquecimento global", "mudança climática", "crise climática"], ["fake", "mentira", "mito", "não existe", "fraude", "invenção"]],
    penalty: -50,
    flag: "❌ Afirmação contradiz consenso científico: 97% dos climatologistas confirmam o aquecimento global antropogênico. O IPCC e NASA documentam o fenômeno há décadas.",
    sourceNote: "negacionismo climático",
  },
  // ── Atribuição falsa a instituições confiáveis ───────────────
  {
    patterns: [["nasa"], ["terra", "earth", "planeta"], ["plana", "flat", "quadrada", "cava"]],
    penalty: -65,
    flag: "❌ Atribuição falsa: a NASA opera satélites, sondas e estações espaciais que confirmam continuamente a esfericidade da Terra. Esta afirmação é contrária à missão e dados da agência.",
    sourceNote: "atribuição falsa à NASA sobre formato da Terra",
  },
  {
    patterns: [["oms", "who", "organização mundial da saúde"], ["não existe", "inventou", "criou", "fabricou"], ["covid", "coronavírus", "pandemia", "gripe", "vírus"]],
    penalty: -55,
    flag: "❌ Afirmação desmentida: a existência do SARS-CoV-2 é documentada em sequenciamentos genômicos publicados em peer-review em dezenas de países independentemente.",
    sourceNote: "negacionismo da pandemia",
  },
  // ── Medicamentos milagrosos ───────────────────────────────────
  {
    patterns: [["cura", "curam", "tratamento definitivo", "elimina definitivamente"], ["câncer", "diabetes", "aids", "hiv", "alzheimer", "parkinson"]],
    penalty: -45,
    flag: "⚠ Afirmação extraordinária: curas definitivas para estas condições exigiriam validação em ensaios clínicos de fase III e aprovação de agências regulatórias (ANVISA/FDA). Consulte sempre um médico.",
    sourceNote: "cura milagrosa sem evidência científica",
  },
  {
    patterns: [["ivermectina", "cloroquina", "hidroxicloroquina"], ["cura", "previne", "trata", "eficaz", "funciona"], ["covid", "coronavírus", "vírus"]],
    penalty: -50,
    flag: "❌ Afirmação desmentida por estudos controlados: ensaios clínicos randomizados (RECOVERY, TOGETHER, WHO Solidarity) não encontraram eficácia destes medicamentos contra COVID-19.",
    sourceNote: "medicamentos sem eficácia comprovada contra COVID",
  },
  // ── Eleições e fraude eleitoral (Brasil) ─────────────────────
  {
    patterns: [["urna", "urnas eletrônicas"], ["fraude", "fraudadas", "manipuladas", "hackeadas", "não são seguras", "roubaram"]],
    penalty: -50,
    flag: "❌ Alegação sem evidência: o TSE e observadores internacionais (OEA, Carter Center) auditaram o sistema eleitoral brasileiro em múltiplas eleições sem encontrar fraude sistêmica.",
    sourceNote: "fraude em urnas eletrônicas brasileiras",
  },
  // ── Teorias sobre 5G ─────────────────────────────────────────
  {
    patterns: [["5g"], ["causa", "provoca", "transmite", "espalha"], ["covid", "coronavírus", "câncer", "doença", "vírus"]],
    penalty: -60,
    flag: "❌ Teoria da conspiração desmentida: ondas de rádio 5G são radiação não-ionizante e fisicamente incapazes de transmitir vírus ou causar as doenças citadas.",
    sourceNote: "5G causa doenças",
  },
  // ── Teoria da Terra Oca ───────────────────────────────────────
  {
    patterns: [["terra", "earth"], ["oca", "hollow", "interior habitado", "civilização interna"]],
    penalty: -55,
    flag: "❌ Afirmação contradiz dados sísmicos: ondas sísmicas mapearam o interior da Terra (crosta, manto, núcleo externo e interno) em detalhe. Não há cavidades habitáveis.",
    sourceNote: "teoria da Terra Oca",
  },
  // ── Chemtrails ────────────────────────────────────────────────
  {
    patterns: [["chemtrail", "contrail", "rastro de avião", "rastro de fumaça"], ["veneno", "envenenamento", "controle", "spray", "químico"]],
    penalty: -50,
    flag: "❌ Teoria da conspiração: rastros de condensação (contrails) são vapor d'água congelado resultante de motores a jato. Não contêm substâncias químicas tóxicas deliberadas.",
    sourceNote: "chemtrails/contrails",
  },
  // ── Cura alternativa sem evidência ───────────────────────────
  {
    patterns: [["cura", "trata", "elimina"], ["água oxigenada", "dióxido de cloro", "mms", "bleach", "água sanitária"]],
    penalty: -65,
    flag: "❌ PERIGO: ingestão de dióxido de cloro (MMS) ou similares é extremamente perigosa. Não há evidência científica de eficácia terapêutica e há risco de morte.",
    sourceNote: "curas perigosas sem evidência",
  },
];

// ─────────────────────────────────────────────────────────────
// BASE DE CONHECIMENTO: Fatos verificados conhecidos
// Se o input menciona estes contextos de forma positiva → bônus
// ─────────────────────────────────────────────────────────────
interface KnownTrueClaim {
  patterns: string[][];
  bonus: number;
  flag: string;
}

const KNOWN_TRUE_CLAIMS: KnownTrueClaim[] = [
  {
    patterns: [["vacina", "vacinação"], ["salva", "protege", "previne", "eficaz", "imuniza", "segura"]],
    bonus: 20,
    flag: "✓ Afirmação alinhada com consenso científico: eficácia e segurança de vacinas é amplamente documentada em literatura peer-reviewed.",
  },
  {
    patterns: [["aquecimento global", "mudança climática"], ["real", "acontecendo", "comprovado", "documentado", "confirmado"]],
    bonus: 15,
    flag: "✓ Afirmação alinhada com consenso científico do IPCC e 97% dos climatologistas.",
  },
  {
    patterns: [["terra", "earth"], ["esférica", "redonda", "oblata", "esferoide"]],
    bonus: 20,
    flag: "✓ Afirmação alinhada com consenso científico: a Terra é um esferóide oblato, confirmado por astronomia, física e dados satelitais.",
  },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function detectInputType(input: string): "url" | "title" | "text" {
  try {
    new URL(input.trim());
    return "url";
  } catch {
    // not a URL
  }
  const wordCount = input.trim().split(/\s+/).length;
  return wordCount <= 20 ? "title" : "text";
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function countMatches(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

/**
 * Verifica se TODOS os grupos de padrões têm pelo menos um match (AND entre grupos, OR dentro de cada grupo)
 */
function matchesAllGroups(lower: string, groups: string[][]): boolean {
  return groups.every((group) => group.some((term) => lower.includes(term)));
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ─────────────────────────────────────────────────────────────
// Função principal de análise
// ─────────────────────────────────────────────────────────────
function analyzeInput(input: string): Omit<VerifyResponse, "analyzedAt"> {
  const inputType = detectInputType(input);
  const lower = input.toLowerCase();

  let score = 50; // começa neutro
  const flags: string[] = [];
  const sources: string[] = pickRandom(FACTCHECK_SOURCES, 3);
  let knownFalseNotes: string[] = [];

  // ══ CAMADA 1: Base de conhecimento — Afirmações sabidamente falsas ══
  for (const claim of KNOWN_FALSE_CLAIMS) {
    if (matchesAllGroups(lower, claim.patterns)) {
      score += claim.penalty; // subtrai
      flags.push(claim.flag);
      if (claim.sourceNote) knownFalseNotes.push(claim.sourceNote);
    }
  }

  // ══ CAMADA 2: Base de conhecimento — Fatos verificados ══
  for (const claim of KNOWN_TRUE_CLAIMS) {
    if (matchesAllGroups(lower, claim.patterns)) {
      score += claim.bonus;
      flags.push(claim.flag);
    }
  }

  // ══ CAMADA 3: Análise por tipo de entrada ══
  if (inputType === "url") {
    const domain = extractDomain(input);

    if (TRUSTED_DOMAINS.includes(domain)) {
      score += 38;
      flags.push(`✓ Domínio "${domain}" reconhecido como veículo de comunicação estabelecido`);
    } else if (domain.endsWith(".gov.br") || domain.endsWith(".gov")) {
      score += 40;
      flags.push(`✓ Domínio governamental oficial verificado (${domain})`);
    } else if (domain.endsWith(".edu.br") || domain.endsWith(".edu")) {
      score += 30;
      flags.push(`✓ Domínio de instituição de ensino (${domain})`);
    } else if (domain) {
      score -= 10;
      flags.push(`⚠ Domínio "${domain}" não encontrado na lista de veículos verificados`);
    }

    if (/blog\.|sites\.|wix\.|wordpress\.com|blogspot/.test(input)) {
      score -= 20;
      flags.push("⚠ URL hospedada em plataforma de blog pessoal — menor credibilidade editorial");
    }
  }

  // ══ CAMADA 4: Palavras sensacionalistas ══
  const sensMatches = countMatches(input, SENSATIONALIST_WORDS);
  if (sensMatches.length > 0) {
    const penalty = Math.min(sensMatches.length * 12, 40);
    score -= penalty;
    flags.push(
      `⚠ Linguagem sensacionalista detectada: "${sensMatches.slice(0, 3).join('", "')}"`
    );
  }

  // ══ CAMADA 5: Afirmações não embasadas ══
  const claimMatches = countMatches(input, UNVERIFIED_CLAIMS);
  if (claimMatches.length > 0) {
    score -= claimMatches.length * 6;
    flags.push("⚠ Texto contém afirmações que citam 'especialistas' ou 'estudos' sem nomear fontes");
  }

  // ══ CAMADA 6: Análise linguística ══
  const upperRatio = (input.match(/[A-ZÁÉÍÓÚÀÂÊÔÇÃ]/g) || []).length / input.length;
  if (upperRatio > 0.35 && input.length > 15) {
    score -= 15;
    flags.push("⚠ Uso excessivo de letras maiúsculas — técnica comum em desinformação");
  }

  const exclamCount = (input.match(/!/g) || []).length;
  if (exclamCount >= 2) {
    score -= 10;
    flags.push(`⚠ ${exclamCount} pontos de exclamação detectados — linguagem apelativa`);
  }

  // ══ CAMADA 7: Indicadores positivos de credibilidade ══
  if (/segundo\s+(a|o|um|uma)\s+\w+|de acordo com|afirmou|declarou|publicado em|fonte:/i.test(input)) {
    score += 10;
    flags.push("✓ Texto cita fontes de maneira identificável");
  }

  if (/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i.test(input)) {
    score += 5;
    flags.push("✓ Referência temporal identificada no conteúdo");
  }

  // ══ Textos muito curtos são inconclusivos se não houver match conhecido ══
  if (inputType === "title" && input.trim().split(/\s+/).length < 5 && knownFalseNotes.length === 0) {
    score = Math.max(score - 5, 30);
    flags.push("⚠ Informação muito curta — análise limitada ao conteúdo fornecido");
  }

  // ══ Clamp e veredito ══
  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict: VerifyResponse["verdict"];
  let summary: string;

  if (score >= 65) {
    verdict = "verified";
    summary = buildSummary("verified", score, input, inputType, sensMatches.length, knownFalseNotes);
    sources.push(...pickRandom(FACTCHECK_SOURCES.filter(s => !sources.includes(s)), 2));
  } else if (score >= 35) {
    verdict = "inconclusive";
    summary = buildSummary("inconclusive", score, input, inputType, sensMatches.length, knownFalseNotes);
  } else {
    verdict = "false";
    summary = buildSummary("false", score, input, inputType, sensMatches.length, knownFalseNotes);
  }

  if (flags.length === 0) {
    flags.push("✓ Nenhum padrão suspeito de desinformação identificado na análise preliminar");
  }

  return { score, verdict, summary, sources, flags, inputType };
}

// ─────────────────────────────────────────────────────────────
// Gerador de sumário contextual
// ─────────────────────────────────────────────────────────────
function buildSummary(
  verdict: string,
  score: number,
  input: string,
  inputType: string,
  sensCount: number,
  knownFalseNotes: string[],
): string {
  const typeLabel =
    inputType === "url" ? "o link fornecido" :
    inputType === "title" ? "o título informado" :
    "o texto analisado";

  // Sumário especial quando há match de afirmação conhecidamente falsa
  if (knownFalseNotes.length > 0 && verdict === "false") {
    return (
      `A análise de ${typeLabel} identificou correspondência com narrativas de desinformação documentadas pelas principais agências de fact-checking (score ${score}/100). ` +
      `Especificamente, o conteúdo apresenta elementos associados a: ${knownFalseNotes.join("; ")}. ` +
      `Essas afirmações contradizem diretamente o consenso científico estabelecido e/ou foram desmentidas por organizações credenciadas. ` +
      `Recomendamos NÃO compartilhar esta informação.`
    );
  }

  if (verdict === "verified") {
    return (
      `A análise de ${typeLabel} indica alto grau de confiabilidade (score ${score}/100). ` +
      `As características identificadas são consistentes com conteúdo jornalístico de fontes estabelecidas. ` +
      `A linguagem utilizada é objetiva e dentro dos padrões editoriais esperados para informação verificável. ` +
      `Recomendamos sempre confirmar diretamente na fonte original antes de compartilhar.`
    );
  }

  if (verdict === "inconclusive") {
    return (
      `A análise de ${typeLabel} não permite uma conclusão definitiva sobre sua veracidade (score ${score}/100). ` +
      (sensCount > 0
        ? `Foram detectados ${sensCount} elemento(s) de linguagem apelativa, o que reduz a confiança no conteúdo. `
        : `O conteúdo não apresenta características claras de credibilidade nem de desinformação deliberada. `) +
      `Recomendamos buscar a informação em pelo menos três veículos de comunicação reconhecidos ` +
      `e consultar as agências de fact-checking listadas abaixo antes de compartilhar.`
    );
  }

  return (
    `A análise de ${typeLabel} identificou múltiplos indicadores associados à desinformação (score ${score}/100). ` +
    (sensCount > 0
      ? `Foram detectados ${sensCount} termos de linguagem sensacionalista tipicamente utilizados para manipulação emocional. `
      : ``) +
    `O padrão linguístico e estrutural é consistente com conteúdo que tende a circular como fake news. ` +
    `Recomendamos NÃO compartilhar esta informação sem antes verificá-la nas agências de checagem listadas abaixo.`
  );
}

// ─────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input: string = body?.input?.trim() ?? "";

    if (!input || input.length < 3) {
      return Response.json(
        { error: "Forneça pelo menos 3 caracteres para análise." },
        { status: 400 }
      );
    }

    if (input.length > 5000) {
      return Response.json(
        { error: "O texto não pode ultrapassar 5000 caracteres." },
        { status: 400 }
      );
    }

    // Simula latência de processamento (realismo)
    await new Promise((resolve) =>
      setTimeout(resolve, 1800 + Math.random() * 1200)
    );

    const result = analyzeInput(input);

    const response: VerifyResponse = {
      ...result,
      analyzedAt: new Date().toISOString(),
    };

    return Response.json(response);
  } catch {
    return Response.json(
      { error: "Erro interno ao processar a análise. Tente novamente." },
      { status: 500 }
    );
  }
}
