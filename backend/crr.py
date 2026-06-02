"""
CRR (Cox-Ross-Rubinstein) binomial options pricing model — pure computation, no I/O.
Reference: John Hull, "Options, Futures, and Other Derivatives".
"""
from math import exp, sqrt


def build_tree(S0: float, K: float, sigma: float, r_cc: float,
               T: float, n: int, tipo: str = "call") -> dict:
    """
    Build the CRR binomial tree and price a European option.

    Parameters
    ----------
    S0    : current stock price
    K     : strike price
    sigma : annualized volatility (decimal)
    r_cc  : continuous risk-free rate (already converted from effective annual)
    T     : time to expiry in years
    n     : number of steps (= number of months in this app)
    tipo  : "call" or "put"

    Returns
    -------
    dict with tree nodes, option price, and performing paths table.
    """
    # ── Step size ────────────────────────────────────────────────────────────
    dt = T / n

    # ── Up/down factors — calibrated by volatility (Hull eq. 13.16) ─────────
    u = exp(sigma * sqrt(dt))
    d = exp(-sigma * sqrt(dt))          # = 1 / u exactly

    # ── Risk-neutral probability (Hull eq. 13.17) ────────────────────────────
    p = (exp(r_cc * dt) - d) / (u - d)

    # ── Forward pass: stock price tree ───────────────────────────────────────
    # S[i][j] = S0 * u^j * d^(i-j)  where i=step, j=number of up-moves
    S = [[0.0] * (i + 1) for i in range(n + 1)]
    for i in range(n + 1):
        for j in range(i + 1):
            S[i][j] = S0 * (u ** j) * (d ** (i - j))

    # ── Payoff at expiry (last column) ───────────────────────────────────────
    C = [[0.0] * (i + 1) for i in range(n + 1)]
    for j in range(n + 1):
        if tipo == "call":
            C[n][j] = max(S[n][j] - K, 0.0)
        else:
            C[n][j] = max(K - S[n][j], 0.0)

    # ── Backward induction: discount from expiry back to today ───────────────
    discount = exp(-r_cc * dt)
    for i in range(n - 1, -1, -1):
        for j in range(i + 1):
            C[i][j] = discount * (p * C[i + 1][j + 1] + (1 - p) * C[i + 1][j])

    # ── Serialize all nodes for the frontend ─────────────────────────────────
    nodes = []
    for i in range(n + 1):
        for j in range(i + 1):
            nodes.append({
                "step": i,
                "j": j,
                "S": round(S[i][j], 4),
                "C": round(C[i][j], 4),
                "po": C[i][j] == 0.0,
            })

    # ── Performing paths: in-the-money terminal nodes ────────────────────────
    # For terminal node (n, j): Cu = adjacent higher payoff, Cd = adjacent lower
    terminal_payoffs = [C[n][j] for j in range(n + 1)]
    performing = []
    for j in range(n + 1):
        payoff = terminal_payoffs[j]
        if payoff > 0.0:
            cu = terminal_payoffs[j + 1] if j + 1 <= n else 0.0
            cd = terminal_payoffs[j - 1] if j - 1 >= 0 else 0.0
            performing.append({
                "scenario": f"{j}↑ {n - j}↓",
                "j": j,
                "S_T": round(S[n][j], 4),
                "K": round(K, 4),
                "payoff": round(payoff, 4),
                "Cu": round(cu, 4),
                "Cd": round(cd, 4),
            })

    return {
        "S0": S0,
        "K": K,
        "sigma": sigma,
        "r_cc": r_cc,
        "T": round(T, 6),
        "n": n,
        "dt": round(dt, 8),
        "u": round(u, 6),
        "d": round(d, 6),
        "p": round(p, 6),
        "tipo": tipo,
        "option_price": round(C[0][0], 4),
        "nodes": nodes,
        "performing_paths": performing,
    }


if __name__ == "__main__":
    # ── Sanity check: S0=100, K=100, sigma=20%, r=5% a.a., T=1 ano, n=3 ─────
    # Black-Scholes reference: ~10.45
    from math import log as _log
    r_cc_test = _log(1 + 0.05)
    res = build_tree(S0=100.0, K=100.0, sigma=0.20, r_cc=r_cc_test, T=1.0, n=3, tipo="call")
    print(f"CRR  C(0,0) = R$ {res['option_price']:.4f}  (BS ref ≈ 10.45)")
    print(f"u={res['u']:.4f}  d={res['d']:.4f}  p={res['p']:.4f}")
    assert 9.0 < res["option_price"] < 13.0, "Preço fora da faixa esperada!"
    print("OK — teste passou.")
