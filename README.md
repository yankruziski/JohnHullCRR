# CRR Options Pricer — John Hull

Simulador de preço justo de opções da B3 usando o modelo binomial de Cox-Ross-Rubinstein, descrito por John Hull.

## Stack

- **Backend:** Python 3.11+ · Flask · yfinance · numpy · pandas
- **Frontend:** HTML + CSS + JS puro · Chart.js (CDN)

## Instalação e execução

```bash
# 1. Crie e ative o virtualenv
python -m venv .venv
source .venv/bin/activate        # Linux / macOS
# .venv\Scripts\activate         # Windows

# 2. Instale as dependências
pip install -r backend/requirements.txt

# 3. Inicie o servidor
python backend/app.py

# 4. Abra no navegador
# http://localhost:5000
```

## Estrutura

```
JohnHullCRR/
├── backend/
│   ├── app.py          # Flask: API + serve frontend
│   ├── crr.py          # Modelo CRR puro (sem I/O)
│   ├── market.py       # yfinance: dados + métricas
│   ├── tickers.json    # Lista curada de ações da B3
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```

## Modelo matemático

| Símbolo | Fórmula | Descrição |
|---------|---------|-----------|
| Δt | T / n | Tamanho do passo |
| u | e^(σ√Δt) | Fator de alta |
| d | e^(−σ√Δt) = 1/u | Fator de baixa |
| p | (e^(rΔt) − d) / (u − d) | Probabilidade neutra ao risco |
| C(i,j) | e^(−rΔt)[p·C(i+1,j+1) + (1−p)·C(i+1,j)] | Indução retroativa |

**Nota:** a taxa SELIC efetiva anual é convertida para taxa contínua antes de entrar nas fórmulas: `r_cc = ln(1 + r_efetiva)`.

## Teste do modelo

```bash
python backend/crr.py
# Deve imprimir:
# CRR  C(0,0) = R$ 11.xxxx  (BS ref ≈ 10.45)
# OK — teste passou.
```
