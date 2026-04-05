#!/usr/bin/env python3
"""
MCP Forecast Validator
======================
Tests 4 forecast methods on 10 tickers × 2 years daily data.
Rolling walk-forward: 252 bars context → predict 5d horizon.
~150 windows per ticker = ~1500 test points total.

Forecast methods:
  1. NAIVE      — last price repeated (random walk baseline)
  2. DRIFT      — linear extrapolation of recent trend (21d)
  3. EWM        — exponential weighted mean (alpha=0.06)
  4. AR5        — autoregressive lag-5 regression (OLS)

Metrics:
  - RMSE         : root mean squared error on 5d horizon (mean of t+1…t+5)
  - MAPE         : mean absolute percentage error
  - DIR_ACC      : directional accuracy (sign of 5d move) vs 50% baseline
  - COVERAGE_80  : % of realizations inside 80% prediction interval
  - COVERAGE_95  : % of realizations inside 95% prediction interval
  - PIW          : prediction interval width (80%) in % of price

Calibration metrics (are the quantiles reliable?):
  - If COVERAGE_80 ≈ 80% → well calibrated
  - If DIR_ACC > 55% consistently → has edge
  - If RMSE / price_std_rolling < 1.0 → beats random walk
"""

import json
import warnings
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from scipy import stats

warnings.filterwarnings('ignore')

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────────────────────
TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "META",
           "SPY",  "ALT",  "SRPT", "TSLA", "JPM"]
WINDOW   = 252   # bars of context
HORIZON  = 5     # days forward
STEP     = 3     # advance 3 days each roll (faster, still robust)
MIN_WINDOWS = 50 # skip ticker if < 50 windows available

# Prediction interval multipliers (assuming normal errors)
Z80  = 1.282  # 80% interval → ±1.282σ
Z95  = 1.960  # 95% interval → ±1.960σ

# ──────────────────────────────────────────────────────────────────────────────
# DATA
# ──────────────────────────────────────────────────────────────────────────────
def fetch_data(tickers, years=3):
    """Download daily close prices for all tickers."""
    end   = datetime.today()
    start = end - timedelta(days=years * 365)
    print(f"[DATA] Fetching {len(tickers)} tickers ({years}y daily)...")
    raw = yf.download(tickers, start=start.strftime('%Y-%m-%d'),
                      end=end.strftime('%Y-%m-%d'), auto_adjust=True,
                      progress=False)
    closes = raw['Close'] if isinstance(raw.columns, pd.MultiIndex) else raw
    closes = closes.dropna(how='all')
    print(f"[DATA] Got {len(closes)} bars, {closes.shape[1]} tickers")
    return closes

# ──────────────────────────────────────────────────────────────────────────────
# FORECASTERS
# ──────────────────────────────────────────────────────────────────────────────

def forecast_naive(prices):
    """Last price repeated for H steps. σ = historical vol × √H."""
    p    = prices[-1]
    rets = np.diff(np.log(prices[-63:]))  # 3m rolling vol
    sigma = rets.std() * p
    fc    = np.full(HORIZON, p)
    lo80  = fc - Z80 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    hi80  = fc + Z80 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    lo95  = fc - Z95 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    hi95  = fc + Z95 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    return fc, lo80, hi80, lo95, hi95

def forecast_drift(prices, trend_window=21):
    """Linear drift: extrapolate last trend_window bars."""
    p     = prices[-1]
    seg   = prices[-trend_window:]
    x     = np.arange(len(seg))
    slope, intercept, *_ = stats.linregress(x, seg)
    fc    = np.array([intercept + slope * (len(seg) + h) for h in range(1, HORIZON+1)])
    # σ from residuals of the fit
    resid = seg - (intercept + slope * x)
    sigma = resid.std() if resid.std() > 0 else p * 0.01
    lo80  = fc - Z80 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    hi80  = fc + Z80 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    lo95  = fc - Z95 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    hi95  = fc + Z95 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    return fc, lo80, hi80, lo95, hi95

def forecast_ewm(prices, alpha=0.06):
    """Exponentially weighted mean — faster mean reversion."""
    weights = np.array([(1 - alpha) ** i for i in range(len(prices))][::-1])
    weights /= weights.sum()
    trend   = np.sum(weights * prices)
    fc      = np.full(HORIZON, trend)
    sigma   = np.diff(np.log(prices[-63:])).std() * prices[-1]
    lo80    = fc - Z80 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    hi80    = fc + Z80 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    lo95    = fc - Z95 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    hi95    = fc + Z95 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    return fc, lo80, hi80, lo95, hi95

def forecast_ar5(prices):
    """AR(5) = OLS on last 5 lags, predict forward iteratively."""
    # Fit on last 60 bars
    seg = prices[-60:]
    n   = len(seg)
    X   = np.column_stack([seg[i:n-5+i] for i in range(5)])
    y   = seg[5:]
    try:
        beta, resid, _, _ = np.linalg.lstsq(
            np.column_stack([np.ones(len(y)), X]), y, rcond=None)
    except Exception:
        return forecast_naive(prices)

    sigma_r = np.std(y - (np.column_stack([np.ones(len(y)), X]) @ beta))
    sigma   = sigma_r if sigma_r > 0 else prices[-1] * 0.01

    # Iterative forecast
    buf = list(prices[-5:])
    fc  = []
    for _ in range(HORIZON):
        feat = np.array([1.0] + buf[-5:])
        p_h  = float(feat @ beta)
        fc.append(p_h)
        buf.append(p_h)
    fc   = np.array(fc)
    lo80 = fc - Z80 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    hi80 = fc + Z80 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    lo95 = fc - Z95 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    hi95 = fc + Z95 * sigma * np.sqrt(np.arange(1, HORIZON+1))
    return fc, lo80, hi80, lo95, hi95

METHODS = {
    'NAIVE': forecast_naive,
    'DRIFT': forecast_drift,
    'EWM':   forecast_ewm,
    'AR5':   forecast_ar5,
}

# ──────────────────────────────────────────────────────────────────────────────
# METRICS
# ──────────────────────────────────────────────────────────────────────────────

def compute_metrics(records):
    """Aggregate per-record results into final metrics dict."""
    df = pd.DataFrame(records)
    n  = len(df)
    if n == 0:
        return {}

    rmse     = float(np.sqrt((df['err'] ** 2).mean()))
    mape     = float((df['abs_pct_err']).mean())
    dir_acc  = float(df['dir_correct'].mean())
    cov80    = float(df['in_80'].mean())
    cov95    = float(df['in_95'].mean())
    piw80    = float(df['piw80_pct'].mean())

    # Skill score vs naive RMSE (filled later)
    return {
        'n_windows': n,
        'rmse':      round(rmse, 4),
        'mape_pct':  round(mape * 100, 3),
        'dir_acc':   round(dir_acc * 100, 2),
        'cov80':     round(cov80 * 100, 2),
        'cov95':     round(cov95 * 100, 2),
        'piw80_pct': round(piw80 * 100, 3),
    }

# ──────────────────────────────────────────────────────────────────────────────
# MAIN ROLLING VALIDATION
# ──────────────────────────────────────────────────────────────────────────────

def validate_ticker(ticker, prices_series):
    prices = prices_series.dropna().values.astype(float)
    if len(prices) < WINDOW + HORIZON + 20:
        print(f"  [{ticker}] Not enough data ({len(prices)} bars), skipping")
        return None

    results = {m: [] for m in METHODS}
    n_windows = 0

    t = WINDOW
    while t + HORIZON <= len(prices):
        ctx    = prices[t - WINDOW : t]
        actual = prices[t : t + HORIZON]

        for name, fn in METHODS.items():
            try:
                fc, lo80, hi80, lo95, hi95 = fn(ctx)
                # Use last horizon point as "5d forecast"
                fc5    = fc[-1]
                act5   = actual[-1]
                p0     = ctx[-1]
                err    = fc5 - act5
                results[name].append({
                    'err':          err,
                    'abs_pct_err':  abs(err) / act5,
                    'dir_correct':  int((fc5 > p0) == (act5 > p0)),
                    'in_80':        int(lo80[-1] <= act5 <= hi80[-1]),
                    'in_95':        int(lo95[-1] <= act5 <= hi95[-1]),
                    'piw80_pct':    (hi80[-1] - lo80[-1]) / p0,
                })
            except Exception as e:
                pass  # skip bad windows

        n_windows += 1
        t += STEP

    print(f"  [{ticker}] {n_windows} windows | {len(prices)} bars")
    return {m: compute_metrics(results[m]) for m in METHODS}

def run_validation():
    print("=" * 60)
    print("  MCP FORECAST VALIDATOR — Walk-forward calibration")
    print(f"  Window={WINDOW}d | Horizon={HORIZON}d | Step={STEP}d")
    print("=" * 60)

    closes = fetch_data(TICKERS, years=3)
    all_results = {}

    for ticker in TICKERS:
        if ticker not in closes.columns:
            print(f"  [{ticker}] Not in data, skipping")
            continue
        print(f"\n[{ticker}]")
        res = validate_ticker(ticker, closes[ticker])
        if res:
            all_results[ticker] = res

    # ── AGGREGATE across tickers ──
    print("\n" + "=" * 60)
    print("  AGGREGATE RESULTS (mean across all tickers)")
    print("=" * 60)

    agg = {m: {'n_windows':[], 'rmse':[], 'mape_pct':[], 'dir_acc':[],
               'cov80':[], 'cov95':[], 'piw80_pct':[]} for m in METHODS}

    for ticker, res in all_results.items():
        for method, metrics in res.items():
            if metrics:
                for k in agg[method]:
                    if k in metrics:
                        agg[method][k].append(metrics[k])

    agg_summary = {}
    for method in METHODS:
        d = agg[method]
        agg_summary[method] = {
            'total_windows': int(sum(d['n_windows'])),
            'rmse_mean':     round(float(np.mean(d['rmse'])), 4) if d['rmse'] else None,
            'mape_mean':     round(float(np.mean(d['mape_pct'])), 3) if d['mape_pct'] else None,
            'dir_acc':       round(float(np.mean(d['dir_acc'])), 2) if d['dir_acc'] else None,
            'cov80':         round(float(np.mean(d['cov80'])), 2) if d['cov80'] else None,
            'cov95':         round(float(np.mean(d['cov95'])), 2) if d['cov95'] else None,
            'piw80_pct':     round(float(np.mean(d['piw80_pct'])), 3) if d['piw80_pct'] else None,
        }

    # ── PRINT TABLE ──
    header = f"{'METHOD':<8} {'WINDOWS':>8} {'RMSE':>8} {'MAPE%':>7} {'DIR%':>7} {'COV80%':>8} {'COV95%':>8} {'PIW80%':>8}"
    print(header)
    print("-" * len(header))
    for method, s in agg_summary.items():
        print(
            f"{method:<8} {s['total_windows']:>8} "
            f"{s['rmse_mean']:>8.4f} "
            f"{s['mape_mean']:>7.2f} "
            f"{s['dir_acc']:>7.2f} "
            f"{s['cov80']:>8.2f} "
            f"{s['cov95']:>8.2f} "
            f"{s['piw80_pct']:>8.3f}"
        )

    # ── CALIBRATION VERDICT ──
    print("\n" + "=" * 60)
    print("  CALIBRATION VERDICT")
    print("=" * 60)
    naive_dir = agg_summary.get('NAIVE', {}).get('dir_acc', 50)

    for method, s in agg_summary.items():
        issues = []
        goods  = []

        # Coverage check
        if s['cov80'] and s['cov80'] < 60:
            issues.append(f"COV80={s['cov80']}% << 80% → severely under-calibrated")
        elif s['cov80'] and s['cov80'] > 95:
            issues.append(f"COV80={s['cov80']}% >> 80% → over-conservative (bands too wide)")
        else:
            goods.append(f"COV80={s['cov80']}% ≈ 80% → well calibrated")

        # Directional check
        if s['dir_acc'] and s['dir_acc'] > 55:
            goods.append(f"DIR={s['dir_acc']}% > 55% → has directional edge")
        elif s['dir_acc'] and s['dir_acc'] < 48:
            issues.append(f"DIR={s['dir_acc']}% < 48% → worse than random!")
        else:
            issues.append(f"DIR={s['dir_acc']}% ≈ 50% → no directional edge")

        # RMSE skill vs naive
        naive_rmse = agg_summary.get('NAIVE', {}).get('rmse_mean', 9999)
        if s['rmse_mean'] and method != 'NAIVE':
            skill = (naive_rmse - s['rmse_mean']) / naive_rmse * 100
            if skill > 5:
                goods.append(f"SKILL={skill:.1f}% better RMSE than naive")
            elif skill < -5:
                issues.append(f"SKILL={skill:.1f}% WORSE RMSE than naive → useless")
            else:
                issues.append(f"SKILL={skill:.1f}% ≈ naive → no magnitude edge")

        verdict = "✅ USABLE" if len(goods) >= 2 and len(issues) == 0 else \
                  "⚠️  PARTIAL" if len(goods) >= len(issues) else "❌ NOT RELIABLE"
        print(f"\n  {method}: {verdict}")
        for g in goods:  print(f"    ✓ {g}")
        for i in issues: print(f"    ✗ {i}")

    # ── WHEN TO USE (calibration rules) ──
    print("\n" + "=" * 60)
    print("  CALIBRATION RULES — When is forecast legitimate?")
    print("=" * 60)
    print("""
  Rule 1 — Coverage Check (calibration gate)
    → Use forecast ONLY if realized coverage > 70% on 80% interval
    → If coverage < 60%: bands are meaningless, don't quote them

  Rule 2 — Directional Edge Gate
    → Use direction signal ONLY if DIR_ACC > 54% over last 50 windows
    → Below: treat as 50/50, don't trade the direction

  Rule 3 — Regime Filter (when forecast degrades)
    → High VIX (>25): RMSE typically 2-3x normal → widen bands ×2
    → Earnings window (±3d): exclude from signals entirely
    → Low-float biotech (< $1B float): n_windows too small, unreliable

  Rule 4 — Horizon Decay
    → t+1 accuracy is always better than t+5
    → Use forecast for t+1 to t+2 only for entry timing
    → t+3 to t+5: use only for scenario framing, not precise targets

  Rule 5 — Skill vs Naive
    → Always compute: skill = (RMSE_naive - RMSE_model) / RMSE_naive
    → Publish skill score alongside any forecast
    → If skill < 3%: the model adds no value, use naive (current price ± band)
  """)

    # ── SAVE RESULTS ──
    output = {
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'config': {'window': WINDOW, 'horizon': HORIZON, 'step': STEP, 'tickers': TICKERS},
        'aggregate': agg_summary,
        'per_ticker': all_results,
    }
    out_path = '/home/ci/projects/articles/mcp/validation/results.json'
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\n[DONE] Full results → {out_path}")
    return output

if __name__ == '__main__':
    run_validation()
