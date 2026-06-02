# PROMPT — Simulador de Preço Justo de Opções (Modelo CRR / John Hull)

> Cole o conteúdo abaixo (a partir de "INÍCIO DO PROMPT") como uma única mensagem para o Sonnet.
> Ele foi escrito para que o modelo gere o projeto completo em uma tacada, com decisões já tomadas.

---

## INÍCIO DO PROMPT

Você é um engenheiro full-stack sênior especializado em finanças quantitativas. Sua tarefa é
construir um **simulador de preço justo de opções de ações da B3** usando o **modelo binomial de
Cox-Ross-Rubinstein (CRR)**, descrito por John Hull. Entregue um projeto **completo, executável e
sem placeholders**: backend em Python, frontend em HTML + CSS + JS puro, com estética de
**terminal Bloomberg**.

Trabalhe de forma incremental, explicando as decisões, e ao final entregue todos os arquivos
prontos para rodar com instruções de execução.

---

### 1. O MODELO (implemente exatamente assim)

O modelo CRR monta uma árvore binomial recombinante de preços do ativo, calcula o payoff da opção
no vencimento e desconta de volta ao presente por **indução retroativa** usando probabilidade
neutra ao risco.

**Parâmetros de entrada do modelo:**
- `S0` — preço atual do ativo (último fechamento disponível no Yahoo Finance).
- `K` — strike (preço de exercício).
- `sigma` (σ) — volatilidade anualizada, calculada a partir do histórico (ver seção 3).
- `r` — taxa livre de risco (anual, contínua — ver nota abaixo).
- `T` — horizonte de tempo total, em anos.
- `n` — número de passos da árvore.
- `tipo` — "call" ou "put".

**Fórmulas (use precisão de ponto flutuante double):**

```
Δt = T / n                          # tamanho de cada passo, em anos
u  = exp(σ * sqrt(Δt))              # fator de alta
d  = exp(-σ * sqrt(Δt)) = 1/u       # fator de baixa
p  = (exp(r * Δt) - d) / (u - d)    # probabilidade neutra ao risco
```

**Preço do ativo em cada nó** (passo `i` de 0..n, com `j` altas, j de 0..i):
```
S(i, j) = S0 * u^j * d^(i - j)
```

**Payoff no vencimento (passo n):**
```
Call: C(n, j) = max(S(n, j) - K, 0)
Put:  C(n, j) = max(K - S(n, j), 0)
```

**Indução retroativa (do passo n-1 até 0):**
```
C(i, j) = exp(-r * Δt) * [ p * C(i+1, j+1) + (1 - p) * C(i+1, j) ]
```

O **preço justo da opção hoje** é `C(0, 0)`.

**Nota importante sobre `r` (taxa):** a entrada do usuário é a SELIC anual efetiva. Converta para
taxa contínua antes de usar nas fórmulas: `r_cc = ln(1 + selic_anual)`. Documente essa conversão.

---

### 2. DECISÕES JÁ TOMADAS (não pergunte, apenas implemente)

1. **Strike (K):** campo de input **manual**, pré-preenchido com `S0` (ATM) ao carregar o ativo.
   O usuário pode editar.
2. **Taxa livre de risco (r):** campo de input **manual**, pré-preenchido com um default de SELIC
   (use `0.105` = 10,5% a.a. como placeholder, em constante claramente sinalizada para ajuste).
3. **Tipo de opção:** **toggle Call / Put**. A árvore é a mesma; só muda a fórmula do payoff.
4. **Granularidade do `n`:** `n` = **número de meses**. Logo `Δt = 1/12` (um mês), `T = n/12` anos.
   A **janela histórica** usada para calcular a volatilidade e as métricas é de **`n` meses para
   trás** a partir de hoje (mesmo tamanho de janela para trás e para frente).

---

### 3. CÁLCULO DA VOLATILIDADE E MÉTRICAS (janela = n meses para trás)

A partir dos dados do Yahoo Finance, baixe o histórico **diário** dos últimos `n` meses (a janela).

- `S0` = último fechamento (ponta direita da janela = "hoje").
- **Volatilidade (σ) anualizada:** calcule os **log-retornos diários** dentro da janela,
  `ret_t = ln(P_t / P_{t-1})`, tire o desvio-padrão amostral e **anualize** multiplicando por
  `sqrt(252)`. Essa é a σ que alimenta o modelo CRR.

**Métricas do período (calcule sobre a janela de `n` meses e exiba):**
- Volatilidade (σ anualizada, em %).
- Média dos preços de fechamento.
- Mediana dos preços de fechamento.
- Variância dos preços (ou dos retornos — rotule claramente qual).
- Retorno buy-and-hold: `(P_fim / P_início - 1)`, em % (início ao fim da janela).
- Máximo Drawdown (em %): maior queda de pico a vale dentro da janela.
- Maior preço da janela.
- Menor preço da janela.

---

### 4. ARQUITETURA E STACK

```
JohnHullCRR/
├── backend/
│   ├── app.py            # servidor Flask: serve a API e os arquivos do frontend
│   ├── crr.py            # modelo CRR puro (sem dependência de I/O): árvore + indução
│   ├── market.py         # yfinance: download, cálculo de σ e métricas da janela
│   ├── tickers.json      # lista curada de ações da B3 (nome + ticker)
│   └── requirements.txt  # flask, yfinance, numpy, pandas
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md             # como instalar e rodar
```

- **Backend:** Python + **Flask**. yfinance para dados. numpy/pandas para cálculo.
  Os tickers da B3 no yfinance usam o sufixo `.SA` (ex.: `VALE3.SA`, `PETR4.SA`).
- **Frontend:** HTML + CSS + JS **puro** (sem framework). Use **Chart.js via CDN** para o gráfico
  de preço e **SVG** (ou D3 via CDN) para a árvore binomial.
- Sirva o frontend pelo próprio Flask (pasta static / rota `/`) para **evitar CORS**.

**Endpoints da API:**
- `GET /api/tickers` → lista de `{nome, ticker}` da B3, para o filtro de busca.
- `GET /api/price?ticker=VALE3&n=3&K=&r=` → retorna JSON com:
  - série histórica da janela (datas + preços de fechamento) para o gráfico;
  - `S0`, `sigma`, `u`, `d`, `p`, `dt`, `T`;
  - todas as métricas da seção 3;
  - a árvore completa (preço do ativo e valor da opção por nó) para **call e put**, ou recalcule
    via parâmetro `tipo`. Inclua para cada nó: `step`, `j`, `S`, `C`, e flag `po` (virou pó:
    `C == 0` num nó terminal/in-the-money? veja seção 5).
  - a tabela de caminhos que performaram (seção 5).

> Se algum ticker não retornar dados no yfinance, devolva erro 4xx com mensagem clara e trate no
> frontend (não quebre a tela).

---

### 5. FRONTEND — LAYOUT (siga o rascunho abaixo, estética Bloomberg)

Título no topo: **"Sistema de precificação de opções com base no CRR de John Hull"**.

Layout, de cima para baixo:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ INPUT ATIVO (busca) ]   [ Período n (meses) ]   [Call|Put]  [ K ] [ r ] │
├──────────────────────────────────────────────────────────────────────────┤
│  NOME DO ATIVO                                                             │
│  Preço ▲                                              R$ XX,XX             │
│        │            ╱╲    ╱╲                          ● ← S0 (ponto que    │
│        │       ╱╲  ╱  ╲  ╱  ╲    ╱╲   ╱╲             ╱   vamos olhar p/    │
│        │  ╱╲ ╱   ╲╱    ╲╱    ╲╱╲╱  ╲ ╱  ╲           ╱     ser nosso S0)    │
│        └──────────────────────────────────────────────► tempo (n meses)   │
├──────────────────────────────────────────────────────────────────────────┤
│  MÉTRICAS DA AÇÃO NO PERÍODO                                               │
│  Vol [   ]   Média [   ]   Mediana [   ]   Variância [   ]                 │
│  Retorno B&H [   ]   Max DD [   ]   Menor preço [   ]   Maior preço [   ]  │
├──────────────────────────────────────────────────────────────────────────┤
│  PARÂMETROS DO MODELO:  u = X (+Y%)   d = X (−Y%)   p = X   Δt = X          │
├──────────────────────────────────────────────────────────────────────────┤
│  ÁRVORE BINOMIAL (recombinante, n passos)                                  │
│        cada nó mostra:  S (preço do ativo)                                 │
│                         C (valor justo da opção)                           │
│                         ∅  se "virou pó" (opção sem valor naquele nó)      │
├──────────────────────────────────────────────────────────────────────────┤
│  CAMINHOS QUE PERFORMARAM (apenas in-the-money)                            │
│  cenário | S_T | K | payoff | Cu | Cd                                      │
├──────────────────────────────────────────────────────────────────────────┤
│  VALOR DA OPÇÃO JUSTA HOJE:  R$ X,XX                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Detalhamento de cada bloco:**

1. **Barra de input (topo):**
   - **Filtro de ativo:** campo de busca tipo *autocomplete* que filtra a lista de `/api/tickers`
     por nome **ou** ticker (a B3 tem poucas empresas, então listar e buscar dentro da lista é o
     ideal). Ao selecionar, carrega os dados.
   - **Período n:** input numérico em **meses** (default 3).
   - **Toggle Call / Put.**
   - **K:** input manual, pré-preenchido com `S0`.
   - **r:** input manual, pré-preenchido com a SELIC default.
   - Recalcula ao mudar qualquer parâmetro.

2. **Gráfico de preço:** linha do preço de fechamento ao longo da janela de `n` meses. O **último
   ponto (ponta direita)** é o `S0` — destaque-o com um marcador e um rótulo `R$ XX,XX` acima dele.
   Eixos rotulados: **Preço** (y) e **tempo (n meses)** (x).

3. **Métricas:** os 8 indicadores da seção 3, em cartões/células de dados densas.

4. **Parâmetros do modelo:** mostre `u` e `d` em **valor** e em **%** (`(u-1)*100` e `(d-1)*100`),
   além de `p`, `Δt`, `T` e a `σ` usada.

5. **Árvore binomial:** desenhe a lattice recombinante (SVG). **Cada nó** exibe:
   - o **preço do ativo** `S(i,j)`;
   - o **valor justo da opção** `C(i,j)`;
   - o símbolo **∅** quando a opção "virou pó" naquele nó (valor zero / fora do dinheiro sem
     chance de payoff). Conecte os nós com arestas de alta (u) e baixa (d). Para `n` grande,
     mantenha legível (zoom/scroll se necessário).

6. **Tabela "caminhos que performaram":** liste **apenas** os cenários terminais que terminaram
   *in-the-money* (payoff > 0). Para cada um, mostre: identificação do cenário (sequência de
   altas/baixas), `S_T`, `K`, `payoff`, e os `Cu`/`Cd` (valores dos nós filhos que alimentaram a
   indução nesse caminho). Filtre fora os caminhos que "viraram pó".

7. **Destaque final:** o **valor da opção justa hoje** = `C(0,0)`, em destaque grande, em R$.

**Estética Bloomberg (obrigatória):**
- Fundo preto/quase-preto (`#000` / `#0a0a0a`).
- Texto âmbar/laranja (`#ff8c00` / `#ffa500`) como cor primária; verde (`#00ff7f`) para valores
  positivos, vermelho para negativos; ciano para destaques secundários.
- Fonte **monoespaçada** (`"IBM Plex Mono"`, `"Consolas"`, `"Courier New"`).
- Layout denso, com cabeçalhos de seção em barras, bordas finas, grid de dados estilo terminal.

---

### 6. VALIDAÇÃO E QUALIDADE

- Valide com **VALE3** (ex.: `n=3`, Call, K ≈ S0) e mostre que o pipeline produz um prêmio
  coerente (no exercício de referência deu ~R$ 6,86 — os valores variam conforme dados de mercado
  do dia, então não force esse número, apenas garanta que o cálculo está correto).
- Trate erros de rede / ticker inexistente / janela sem dados suficientes (ex.: `n` muito pequeno).
- Comente o código nos pontos do modelo (forward pass, payoff, backward induction).
- Inclua `requirements.txt` e um `README.md` com passos exatos: criar venv, `pip install -r`,
  `python backend/app.py`, abrir `http://localhost:5000`.
- Mantenha `crr.py` **puro** (entra parâmetros, sai árvore + preço), sem chamadas de rede, para
  facilitar testes. Inclua ao menos um teste simples comparando `C(0,0)` com um caso conhecido.

### 7. ENTREGÁVEL

Gere **todos os arquivos** com o conteúdo completo, na estrutura da seção 4, prontos para rodar.
Ao final, liste os comandos de execução e um checklist do que foi implementado.

## FIM DO PROMPT
