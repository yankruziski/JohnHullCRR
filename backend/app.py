"""
Flask backend — serves the API and the frontend static files.
"""
import json
import os
from math import log

from flask import Flask, jsonify, request, send_from_directory

from crr import build_tree
from market import get_market_data

# ── Config ────────────────────────────────────────────────────────────────────
SELIC_DEFAULT = 0.105  # 10.5% a.a. efetiva — ajuste aqui conforme SELIC atual

BASE_DIR = os.path.dirname(__file__)
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

# Load the curated B3 ticker list once at startup
with open(os.path.join(BASE_DIR, "tickers.json"), encoding="utf-8") as _f:
    TICKERS: list[dict] = json.load(_f)

TICKER_MAP: dict[str, str] = {t["ticker"]: t["nome"] for t in TICKERS}

app = Flask(__name__, static_folder=None)


# ── Frontend static files ─────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename: str):
    return send_from_directory(FRONTEND_DIR, filename)


# ── API ───────────────────────────────────────────────────────────────────────

@app.route("/api/tickers")
def api_tickers():
    return jsonify(TICKERS)


@app.route("/api/price")
def api_price():
    ticker = request.args.get("ticker", "").upper().strip()
    if not ticker:
        return jsonify({"error": "Parâmetro 'ticker' obrigatório."}), 400

    try:
        n = int(request.args.get("n", 3))
        if n < 1:
            raise ValueError("n deve ser >= 1")
    except ValueError as exc:
        return jsonify({"error": f"Parâmetro 'n' inválido: {exc}"}), 400

    k_raw = request.args.get("K", "").strip()
    r_raw = request.args.get("r", "").strip()
    tipo = request.args.get("tipo", "call").lower()

    if tipo not in ("call", "put"):
        return jsonify({"error": "Parâmetro 'tipo' deve ser 'call' ou 'put'."}), 400

    # ── Fetch market data ─────────────────────────────────────────────────────
    try:
        mkt = get_market_data(ticker, n)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    S0 = mkt["S0"]
    K = float(k_raw) if k_raw else S0

    try:
        r_input = float(r_raw) if r_raw else SELIC_DEFAULT
    except ValueError:
        r_input = SELIC_DEFAULT

    # Convert SELIC (effective annual rate) → continuous rate for CRR formulas
    # Hull: r_cc = ln(1 + r_efetiva)
    r_cc = log(1 + r_input)

    T = n / 12.0  # n months → years

    # ── Run CRR model ─────────────────────────────────────────────────────────
    try:
        tree = build_tree(
            S0=S0,
            K=K,
            sigma=mkt["sigma"],
            r_cc=r_cc,
            T=T,
            n=n,
            tipo=tipo,
        )
    except Exception as exc:
        return jsonify({"error": f"Erro no modelo CRR: {exc}"}), 500

    nome = TICKER_MAP.get(ticker, ticker)

    response = {
        "ticker": ticker,
        "nome": nome,
        "dates": mkt["dates"],
        "prices": mkt["prices"],
        "S0": S0,
        "K": K,
        "r_input": r_input,
        "r_cc": round(r_cc, 6),
        "sigma": mkt["sigma"],
        "T": round(T, 6),
        "n": n,
        "dt": tree["dt"],
        "u": tree["u"],
        "d": tree["d"],
        "p": tree["p"],
        "tipo": tipo,
        "option_price": tree["option_price"],
        "metrics": mkt["metrics"],
        "nodes": tree["nodes"],
        "performing_paths": tree["performing_paths"],
    }

    return jsonify(response)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)
