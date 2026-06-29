# 🔍 Evidentia - Verificador de Confiabilidade

> 🎓 **Projeto Acadêmico:** Este projeto é um protótipo desenvolvido para a disciplina de **Tecnologia da Informação e Sociedade** do curso de **Tecnologia da Informação (TI)** da **UFRN**.

O **Evidentia** é um sistema que recebe uma informação (um link, um título de notícia ou um trecho de texto) e devolve um **Score de Confiabilidade** — um número de 0 a 100 que indica o quão confiável aquela informação é.

## ✨ Destaques

- **Análise em 7 Camadas**: Motor de verificação que analisa narrativas falsas, fatos comprovados, domínios, palavras sensacionalistas, aspectos linguísticos e indicadores de credibilidade.
- **Vereditos Claros**: Classifica as informações analisadas como:
  - ✅ **Verificada** (score ≥ 65)
  - ⚠️ **Inconclusiva** (score entre 35 e 64)
  - ❌ **Potencialmente Falsa** (score < 35)
- **Privacidade (Histórico Local)**: Todas as verificações são salvas automaticamente no `localStorage` do navegador, garantindo que o histórico seja privado e sem necessidade de login.
- **Rápido e Responsivo**: Protótipo autônomo sem dependências externas de APIs para a análise em tempo real.

## 🧠 Como Funciona o Motor de Análise

O "cérebro" do sistema não consulta a internet em tempo real, mas aplica regras rigorosas de verificação sobre o texto:

1. **Base de Narrativas Falsas Conhecidas**: Penaliza textos com combinações de palavras que indicam desinformação documentada (ex: vacina + microchip).
2. **Base de Fatos Verificados**: Recompensa textos que corroboram fatos estabelecidos cientificamente.
3. **Verificação de Domínio**: Avalia e bonifica URLs de portais de notícias reconhecidos ou domínios `.gov.br` / `.edu.br`.
4. **Palavras Sensacionalistas**: Penaliza linguagem alarmista ou exagerada (`URGENTE`, `BOMBA`, `EXCLUSIVO`).
5. **Afirmações Sem Fonte**: Subtrai pontos ao detectar frases vagas como "especialistas dizem que".
6. **Análise Linguística**: Detecta e penaliza excesso de CAIXA ALTA e sinais de exclamação !!!
7. **Indicadores de Credibilidade**: Bonifica textos com características jornalísticas, como citação clara de fontes e datas.

## 🧭 Visão Geral

- **Framework**: Next.js 16 (App Router)
- **Biblioteca UI**: React 19
- **Estilização**: TailwindCSS v4
- **Linguagem**: TypeScript
- **Armazenamento**: LocalStorage

## 📂 Estrutura do Projeto

```text
evidentia/
├── public/                 # Assets públicos
├── src/                    # Código-fonte principal da aplicação
├── relatorio_projeto_tis   # Documentação de referência e lógica do motor
├── next.config.ts          # Configurações do Next.js
└── package.json            # Dependências e scripts do projeto
```

## 🚀 Como Executar Localmente

1. Clone o repositório e acesse a pasta do projeto:
   ```bash
   cd evidentia
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse [http://localhost:3000](http://localhost:3000) no seu navegador para testar a aplicação.
