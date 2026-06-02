"""
Market data layer — downloads historical prices from Yahoo Finance and computes
volatility + period metrics for the CRR model.
"""
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from math import sqrt


def get_market_data(ticker_symbol: str, n_months: int) -> dict:
    """
    Download `n_months` of daily closing prices for a B3 stock.

    ticker_symbol : e.g. "VALE3"  (suffix .SA appended automatically)
    n_months      : window size — same number of months used for the CRR tree

    Returns a dict with:
      - historical series (dates + prices) for the price chart
      - S0, sigma and all 8 period metrics
    """
    yf_ticker = ticker_symbol if ticker_symbol.endswith(".SA") else ticker_symbol + ".SA"

    # Add a 10-day buffer so we always have enough trading days
    end_dt = datetime.today()
    start_dt = end_dt - timedelta(days=int(n_months * 31 + 10))

    tkr = yf.Ticker(yf_ticker)
    hist = tkr.history(
        start=start_dt.strftime("%Y-%m-%d"),
        end=end_dt.strftime("%Y-%m-%d"),
        interval="1d",
        auto_adjust=True,
    )

    if hist.empty:
        raise ValueError(f"Nenhum dado encontrado para '{ticker_symbol}'. Verifique o ticker.")

    raw = hist["Close"]
    close: pd.Series = (raw.iloc[:, 0] if isinstance(raw, pd.DataFrame) else raw).dropna()

    if len(close) < 5:
        raise ValueError(
            f"Dados insuficientes para '{ticker_symbol}' na janela de {n_months} meses. "
            "Tente aumentar n."
        )

    # Keep only the last n_months * ~21 trading days
    target_days = max(int(n_months * 21), 5)
    if len(close) > target_days:
        close = close.iloc[-target_days:]

    prices = close.values.astype(float)
    dates = [str(d)[:10] for d in close.index]

    S0 = float(prices[-1])

    # ── Volatility: annualized std of log-returns ─────────────────────────────
    log_ret = np.log(prices[1:] / prices[:-1])
    sigma_daily = float(np.std(log_ret, ddof=1))
    sigma_annual = sigma_daily * sqrt(252)

    if sigma_annual <= 0:
        raise ValueError("Volatilidade calculada é zero — janela sem variação de preços.")

    # ── Period metrics ────────────────────────────────────────────────────────
    mean_price = float(np.mean(prices))
    median_price = float(np.median(prices))
    variance_log_ret = float(np.var(log_ret, ddof=1))
    bah_return_pct = float((prices[-1] / prices[0] - 1) * 100)

    # Maximum Drawdown: largest peak-to-trough drop within the window
    peak = prices[0]
    max_dd = 0.0
    for p in prices:
        if p > peak:
            peak = p
        dd = (peak - p) / peak
        if dd > max_dd:
            max_dd = dd

    max_price = float(np.max(prices))
    min_price = float(np.min(prices))

    return {
        "ticker": ticker_symbol,
        "dates": dates,
        "prices": [round(float(p), 2) for p in prices],
        "S0": round(S0, 2),
        "sigma": round(sigma_annual, 6),
        "metrics": {
            "volatility_pct": round(sigma_annual * 100, 2),
            "mean_price": round(mean_price, 2),
            "median_price": round(median_price, 2),
            "variance_log_ret": round(variance_log_ret, 8),
            "bah_return_pct": round(bah_return_pct, 2),
            "max_drawdown_pct": round(max_dd * 100, 2),
            "max_price": round(max_price, 2),
            "min_price": round(min_price, 2),
        },
    }
