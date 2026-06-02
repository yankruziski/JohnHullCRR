# Simulador CRR — Precificação de Opções da B3

Um simulador **interativo e visual** de preço justo de opções (Call e Put) usando o modelo binomial de Cox-Ross-Rubinstein (CRR), descrito por John Hull em seu livro clássico *Options, Futures, and Other Derivatives*.

> **O que você faz aqui:** seleciona uma ação da B3, define o período de análise e os parâmetros da opção (strike, tipo), e o simulador constrói uma árvore binomial de cenários futuros, calcula o prêmio justo e mostra todos os caminhos que resultam em lucro.

---

## 🚀 Início rápido

### Pré-requisitos

- **Python 3.11+**
- **Git** (para clonar o repo)

### Instalação (2 minutos)

```bash
# 1. Clone o repositório
git clone https://github.com/yankruziski/JohnHullCRR.git
cd JohnHullCRR

# 2. Crie e ative o ambiente virtual
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows
.venv\Scripts\activate

# 3. Instale as dependências
pip install -r backend/requirements.txt

# 4. Inicie o servidor
python backend/app.py
```

**Resultado esperado:**
```
 * Running on http://127.0.0.1:5000
 * Press CTRL+C to quit
```

### Abra no navegador

Acesse **`http://localhost:5000`** em qualquer navegador moderno (Chrome, Firefox, Safari, Edge).

---

## 📖 Como usar a interface

### Barra de controle (topo)

```
┌─────────────────────────────────────────────────┐
│ ATIVO [VALE3 ▼]  n [3]  CALL|PUT  K [81.7]  r [0.105] │
└─────────────────────────────────────────────────┘
```

| Campo | Descrição | Default |
|-------|-----------|---------|
| **ATIVO** | Digite o ticker (ex: `VALE3`, `PETR4`) ou o nome (ex: `Vale`, `Petrobras`) e selecione na lista | — |
| **n (MESES)** | Quantos meses para frente queremos calcular a opção. Quanto maior, mais passos na árvore. | 3 |
| **CALL \| PUT** | Toggle: CALL = direito de compra; PUT = direito de venda | CALL |
| **K (STRIKE)** | Preço de exercício. Pré-preenchido com S₀ (ATM = at-the-money). Você pode editar. | S₀ |
| **r (SELIC)** | Taxa livre de risco anual (SELIC). Em decimais (ex: `0.105` = 10,5% a.a.) | 0.105 |

**Depois de preencher, clique `▶ CALCULAR` ou pressione ENTER.**

---

## 📊 Visualizações e resultados

A interface mostra 7 seções após o cálculo:

### 1. **Gráfico de preço histórico**

- Série dos últimos `n` meses de fechamentos diários da ação.
- O **último ponto (ponta direita)** é S₀, em verde com rótulo `R$ XX,XX`.
- Eixo X: tempo (datas); Eixo Y: preço em reais.

### 2. **Métricas do período**

Estatísticas calculadas sobre os `n` meses de histórico:

| Métrica | O que significa | Fórmula / Nota |
|---------|-----------------|----------------|
| **VOL σ (a.a.)** | Volatilidade anualizada em %. Maior = maior incerteza de preço. | `std(log-retornos diários) × √252` |
| **MÉDIA** | Preço médio no período. | Média aritmética dos fechamentos |
| **MEDIANA** | Preço central. Menos afetada por outliers que a média. | 50º percentil |
| **VAR (log-ret)** | Variância dos log-retornos diários. Medida alternativa de dispersão. | `var(ln(P_t / P_{t-1}))` |
| **RETORNO B&H** | Buy-and-hold: ganho/perda percentual do início ao fim do período. | `(P_fim / P_início - 1) × 100%` |
| **MAX DRAWDOWN** | Queda máxima de pico para vale. Mede o pior cenário de timing. | `(max_peak - min_vale) / max_peak × 100%` |
| **MENOR PREÇO** | Preço mínimo do período. | `min(P_t)` |
| **MAIOR PREÇO** | Preço máximo do período. | `max(P_t)` |

### 3. **Parâmetros do modelo**

Mostra os parâmetros calculados ou inseridos:

```
σ = 28.94%   u = 1.0871 (+8.71%)   d = 0.9198 (−8.02%)   p = 0.5291
Δt = 0.0833 anos   T = 0.2500 anos   K = R$ 81.70   r SELIC 10.50% → r_cc 9.95%
```

**O que cada um faz:**
- **σ** = volatilidade que calibra o tamanho dos movimentos de preço.
- **u** = fator de alta (em um passo, preço sobe 8,71%).
- **d** = fator de baixa (em um passo, preço cai 8,02%).
- **p** = probabilidade neutra ao risco (não é a probabilidade real de alta; é um ajuste matemático para igualar expectativas).
- **Δt** = tamanho do passo: 1 mês = 1/12 anos.
- **T** = horizonte total: 3 meses = 3/12 = 0,25 anos.
- **r_cc** = taxa contínua usada nas fórmulas (convertida de SELIC efetiva).

### 4. **Árvore binomial**

A malha recombinante que mostra todos os cenários possíveis:

```
       ●─────●─────●─────●          Cada nó exibe:
      ╱│╲   ╱│╲   ╱│╲   ╱│╲         • S = preço do ativo naquele nó
    ●─ ─●─ ─●─ ─●          • C = valor justo da opção
   ╱│╲ ╱│╲ ╱│╲              • ∅ = "virou pó" (opção sem valor)
  ●─ ─●─ ─●
 ╱│╲ ╱│╲
●─ ─●   ← hoje (S₀)
```

- **Linhas verdes** = movimento de alta (u).
- **Linhas vermelhas** = movimento de baixa (d).
- **Nó raiz (embaixo à esquerda)** = hoje, preço = S₀, valor = C₀ (o prêmio que buscamos).
- **Nós terminais (topo à direita)** = futuro (mês n), valor = payoff da opção.

### 5. **Caminhos que performaram (in-the-money)**

Tabela dos cenários terminais que resultaram em lucro:

```
CENÁRIO | S_T      | K       | PAYOFF  | Cu      | Cd
3↑ 0↓   | R$ 100.5 | R$ 81.7 | R$ 18.8 | R$ 20.3 | R$ 16.9
2↑ 1↓   | R$ 88.2  | R$ 81.7 | R$ 6.5  | R$ 10.2 | R$ 3.1
```

- **CENÁRIO** = número de altas e baixas (ex: 3↑ 0↓ = subiu 3 vezes, não caiu).
- **S_T** = preço final do ativo nesse cenário.
- **PAYOFF** = lucro/perda da opção (Call: max(S_T − K, 0); Put: max(K − S_T, 0)).
- **Cu, Cd** = valores intermediários que alimentam a indução retroativa.

### 6. **Valor da opção justa hoje** ⭐

O resultado final em destaque:

```
★ VALOR DA OPÇÃO JUSTA HOJE (CALL)
R$ 6,11
VALE3 — CALL — K R$ 81.70 — 3 meses — σ 28.94%
```

Esse é o **prêmio justo** que a opção deveria custar hoje (segundo o modelo CRR).

---

## 🧮 O modelo matemático (explicado)

### O que é o modelo CRR?

O **modelo binomial CRR** assume que, a cada período (no nosso caso, 1 mês):
- O preço pode subir (multiplicado por **u**) ou descer (multiplicado por **d**).
- Não existem outras possibilidades — é "binomial" (dois ramos por nó).
- Isso cria uma árvore de cenários futuros.

### Os 5 passos

#### 1️⃣ **Forward pass: construir a árvore de preços**

Começamos com S₀ (hoje) e multiplicamos por u ou d em cada passo:

```
S(i, j) = S₀ × u^j × d^(i-j)

onde:
  i = passo (0 a n)
  j = número de altas até agora (0 a i)
```

**Exemplo com n=3, S₀=81.7, u=1.0871, d=0.9198:**

| Mês 0 | Mês 1 | Mês 2 | Mês 3 |
|-------|-------|-------|-------|
| 81.7  | 88.8 / 75.1 | 96.6 / 81.7 / 69.1 | 105.0 / 88.8 / 73.4 / 63.6 |

#### 2️⃣ **Calcular o payoff no vencimento (última coluna)**

No final do horizonte (mês n), a opção vale seu valor intrínseco:

**Para Call:**
```
C(n, j) = max(S(n, j) − K, 0)
```
Se S(n,j) > K, a opção vale a diferença; senão, vale 0.

**Para Put:**
```
C(n, j) = max(K − S(n, j), 0)
```

#### 3️⃣ **Backward induction: descontar para hoje**

Começamos no final da árvore e voltamos passo a passo:

```
C(i, j) = e^(−r·Δt) × [ p × C(i+1, j+1) + (1−p) × C(i+1, j) ]
```

**Em português:** o valor da opção em um nó é a expectativa ponderada (probabilidade p) dos dois filhos, descontada por um período.

#### 4️⃣ **O valor justo é C(0, 0)**

Quando chegamos na raiz (hoje), temos o prêmio justo.

### As fórmulas-chave

| O quê | Fórmula | Explicação |
|-------|---------|-----------|
| Tamanho do passo | Δt = T / n | Divide o tempo total em n passos |
| Fator de alta | u = e^(σ√Δt) | Calibrado pela volatilidade |
| Fator de baixa | d = e^(−σ√Δt) = 1/u | Sempre o inverso exato de u |
| Prob. neutra ao risco | p = (e^(r·Δt) − d) / (u − d) | Ajusta a "gravidade" do desconto |
| Conversão SELIC | r_cc = ln(1 + r_efetiva) | SELIC discreta → taxa contínua |
| Desconto | e^(−r·Δt) | Traz futuro para presente |

---

## 💡 Exemplo prático: VALE3 Call 3 meses

**Cenário:** 2 de junho de 2026

```
Entrada:
  Ticker: VALE3
  n: 3 meses
  Tipo: CALL
  K: R$ 81.70 (ATM, igual a S₀)
  r: 10.5% a.a. (SELIC)

Dados do mercado:
  S₀ = R$ 81.70
  σ = 28.94% a.a. (calculada dos últimos 3 meses)
  
Resultado:
  ★ Prêmio justo = R$ 6,11

Interpretação:
  Se você comprasse essa opção Call hoje, deveria pagar ~R$ 6,11.
  Se pagar menos, é barato (aproveita).
  Se pagar mais, é caro (evita).
```

---

## 🔧 Estrutura do projeto

```
JohnHullCRR/
├── backend/
│   ├── app.py                # Flask app: endpoints /api/tickers e /api/price
│   ├── crr.py                # Modelo CRR puro (testável, sem I/O)
│   ├── market.py             # yfinance: histórico + métricas
│   ├── tickers.json          # 87 ações da B3 (nome + ticker)
│   └── requirements.txt       # Dependências Python
│
├── frontend/
│   ├── index.html            # Layout Bloomberg
│   ├── style.css             # Design terminal preto + âmbar
│   └── app.js                # Lógica: autocomplete, cálculo, gráficos
│
├── README.md                 # Este arquivo
└── PROMPT.md                 # Prompt original que gerou o projeto
```

### Backend (Python)

**`crr.py`** — Modelo puro
- Entrada: S₀, K, σ, r, T, n, tipo
- Saída: árvore completa, nós, prêmio, caminhos in-the-money
- Sem dependências externas (só `math`)
- Testável: `python backend/crr.py`

**`market.py`** — Dados de mercado
- Baixa histórico de `n` meses do Yahoo Finance
- Calcula σ: log-retornos diários → desvio-padrão → anualiza por √252
- Calcula as 8 métricas do período
- Trata erros de rede e dados insuficientes

**`app.py`** — API Flask
- `GET /api/tickers` → lista curada de ações da B3
- `GET /api/price?ticker=VALE3&n=3&tipo=call&K=81.7&r=0.105`
  - Faz download dos dados
  - Calcula σ
  - Converte SELIC → taxa contínua
  - Roda CRR
  - Retorna JSON completo
- Sirva o frontend estaticamente (evita CORS)

### Frontend (JavaScript puro)

**`app.js`** — Lógica principal
- Autocomplete de ativos (busca por nome ou ticker)
- Toggle Call/Put em tempo real
- API: fetch `/api/price` ao clicar CALCULAR
- Renderiza: gráfico Chart.js, métricas, árvore SVG, tabela de caminhos

**`style.css`** — Design Bloomberg
- Fundo preto (#000), texto âmbar (#ffa500)
- Fonte monoespaçada (IBM Plex Mono)
- Grid denso com bordas finas
- Verde/vermelho para valores positivos/negativos

---

## 🧪 Testes

```bash
# Teste rápido do modelo CRR
python backend/crr.py

# Saída esperada:
# CRR  C(0,0) = R$ 10.9830  (BS ref ≈ 10.45)
# OK — teste passou.
```

**Validação:** comparamos com Black-Scholes (~10.45). CRR com n=3 dá ~10.98, que é coerente. Quanto maior n, mais próximo de Black-Scholes.

---

## 📚 Referências

- **John Hull** (2023). *Options, Futures, and Other Derivatives* (12ª ed.).
  - Capítulo 13: "The Binomial Model"
  - Equações 13.16 e 13.17 (fatores u, d e probabilidade p)

- **Cox, Ross & Rubinstein** (1979). "Option pricing: A simplified approach". *Journal of Financial Economics*.
  - Artigo clássico que introduziu o modelo binomial.

---

## ❓ FAQ

### P: Por que a minha opção Call não está in-the-money em todos os cenários?
**R:** Uma opção só tem valor se terminar acima do strike (para Call) ou abaixo (para Put). Se em um caminho a ação cai, o payoff é zero — a opção "vira pó".

### P: Por que r_cc ≠ SELIC?
**R:** Porque SELIC é uma taxa efetiva (discreta), e as fórmulas CRR usam taxa contínua. Convertemos com `r_cc = ln(1 + SELIC)`.

### P: Posso mudar K depois de selecionar o ativo?
**R:** Sim! Edite o campo K e clique CALCULAR novamente. A árvore será recalculada.

### P: Por que o prêmio muda ao mudar n?
**R:** Porque n > horizonte > mais tempo para a ação oscilar > mais chance de lucro > prêmio mais alto (tudo mais igual).

### P: O modelo é preciso para opções reais da B3?
**R:** O CRR é educacional e simplificado. Para trading real, você precisa:
- Opções americanas (esse é europeu)
- Volatilidade implícita (aqui usamos histórica)
- Custo de transação, bid-ask spread, juros de financiamento
- Modelo Black-Scholes ou modelos mais avançados

---

## 🤝 Contribuições

Sugestões e melhorias são bem-vindas! Abra uma issue ou PR no GitHub.

---

**Autor:** Claude Code (Anthropic)  
**Licença:** MIT  
**Última atualização:** 2 de junho de 2026
