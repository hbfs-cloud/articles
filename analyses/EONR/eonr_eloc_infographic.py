import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

BG       = '#f8fafc'
WHITE    = '#ffffff'
TEXT     = '#0f172a'
TEXT_MUT = '#64748b'
TEXT_LT  = '#94a3b8'
BORDER   = '#e2e8f0'
NEG      = '#ef4444'
NEG_SOFT = '#fee2e2'
BLUE     = '#3b82f6'
AMBER    = '#f59e0b'
PURPLE   = '#9333ea'
SLATE    = '#475569'

plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.sans-serif': ['Inter', 'Helvetica Neue', 'Arial'],
    'text.color': TEXT,
})

fig, ax1 = plt.subplots(figsize=(14, 8), facecolor=BG, dpi=200)
fig.subplots_adjust(left=0.08, right=0.88, top=0.88, bottom=0.12)
ax1.set_facecolor(WHITE)

# ═══════════ DATA ═══════════

# Historical: Oct 2022 (month 0) to Jun 2026 (month 44)
months = np.arange(0, 45)
np.random.seed(42)
price_base = 10.86 * np.exp(-0.07 * months) + 0.3
noise = np.random.normal(0, 0.06, len(months)) * price_base * 0.10
price = np.clip(price_base + noise, 0.35, 12)
price[0] = 10.86; price[-1] = 0.50

# Shares outstanding: stepped up at draw events
shares = np.full(45, 20.0)  # ~20M at ELOC signing
shares[14:] = 20.6   # Nov 2023: +578K commitment
shares[26:] = 24.0   # Dec 2024: draws begin
shares[35:] = 38.0   # Sep 2025: 13.97M shares issued
shares[40:] = 42.0   # early 2026
shares[44] = 46.0    # today

# Projection: Jun 2026 (44) to Dec 2026 (50)
proj_months = np.arange(44, 51)
# Price continues down as draws accelerate
proj_price = 0.50 * np.exp(-0.06 * (proj_months - 44))
proj_price_low = 0.50 * np.exp(-0.12 * (proj_months - 44))
# Shares explode: $141.9M remaining, drawn at declining prices
# Conservative: $20M more drawn at avg ~$0.35 = +57M shares
proj_shares = 46 + np.cumsum([0, 8, 12, 15, 18, 22, 28])  # accelerating
proj_shares_high = 46 + np.cumsum([0, 15, 25, 35, 45, 55, 70])  # worst case

vwap_line = price * 0.96

# ═══════════ LEFT AXIS: PRICE ═══════════

# VWAP spread
ax1.fill_between(months, price, vwap_line, alpha=0.08, color=NEG, zorder=1)

# Historical price
ax1.plot(months, price, color=TEXT, linewidth=2.5, zorder=4, label='Cours EONR')
ax1.plot(months, vwap_line, color=NEG, linewidth=1, linestyle='--', alpha=0.5,
         zorder=3, label='Seuil WL (96% VWAP)')

# Projection price
ax1.fill_between(proj_months, proj_price, proj_price_low, alpha=0.06, color=NEG)
ax1.plot(proj_months, proj_price, color=NEG, linewidth=1.5, linestyle=':', alpha=0.5, zorder=3)

ax1.set_ylabel('Prix ($)', fontsize=10, color=TEXT, fontweight='bold')
ax1.yaxis.set_major_formatter(mticker.FormatStrFormatter('$%.0f'))
ax1.tick_params(axis='y', labelsize=8, colors=TEXT)
ax1.set_ylim(0, 13)

# ═══════════ RIGHT AXIS: SHARES ═══════════

ax2 = ax1.twinx()

# Historical shares (area fill)
ax2.fill_between(months, 0, shares, alpha=0.12, color=PURPLE, zorder=1)
ax2.plot(months, shares, color=PURPLE, linewidth=2, zorder=3, label='Shares outstanding (M)')

# Projection shares
ax2.fill_between(proj_months, proj_shares, proj_shares_high, alpha=0.08, color=PURPLE)
ax2.plot(proj_months, proj_shares, color=PURPLE, linewidth=1.5, linestyle=':', alpha=0.6, zorder=3)
ax2.plot(proj_months, proj_shares_high, color=PURPLE, linewidth=0.8, linestyle=':', alpha=0.3)

ax2.set_ylabel('Shares outstanding (M)', fontsize=10, color=PURPLE, fontweight='bold')
ax2.tick_params(axis='y', labelsize=8, colors=PURPLE)
ax2.set_ylim(0, 350)
ax2.yaxis.set_major_formatter(mticker.FormatStrFormatter('%.0fM'))

# ═══════════ TODAY LINE ═══════════

ax1.axvline(x=44, color=BLUE, linewidth=1.5, alpha=0.3, zorder=2)
ax1.text(44, 12.5, 'Aujourd\'hui', fontsize=8, color=BLUE, fontweight='bold',
         ha='center', va='top')

# ═══════════ ANNOTATIONS ═══════════

# Draw events
ax1.annotate('$2.6M tires\nDec 2024', xy=(26, price[26]), xytext=(20, 5.5),
             fontsize=8, color=AMBER, fontweight='bold', linespacing=1.3,
             arrowprops=dict(arrowstyle='->', color=AMBER, lw=0.8))

ax1.annotate('$8.1M cumul\n13.97M shares\nSep 2025', xy=(35, price[35]),
             xytext=(30, 4), fontsize=8, color=NEG, fontweight='bold', linespacing=1.3,
             arrowprops=dict(arrowstyle='->', color=NEG, lw=0.8))

# Price annotations
ax1.text(-0.5, 10.86, '$10.86', fontsize=8, color=TEXT_MUT, ha='right', va='center')
ax1.text(44.5, 0.50, '$0.50', fontsize=9, color=BLUE, fontweight='bold', ha='left', va='center')

# Shares annotations
ax2.text(44.5, 46, '46M', fontsize=9, color=PURPLE, fontweight='bold', ha='left', va='bottom')
ax2.text(50.5, proj_shares[-1], f'{proj_shares[-1]:.0f}M', fontsize=8,
         color=PURPLE, fontweight='bold', ha='left', va='center')
ax2.text(50.5, proj_shares_high[-1], f'{proj_shares_high[-1]:.0f}M', fontsize=7,
         color=PURPLE, ha='left', va='center', alpha=0.5)

# Death spiral callout
ax1.text(22, 9, 'Prix chute\nShares explosent\n= DEATH SPIRAL', fontsize=10,
         color=NEG, fontweight='bold', ha='center', va='center', linespacing=1.5,
         bbox=dict(boxstyle='round,pad=0.6', facecolor=NEG_SOFT, edgecolor=NEG,
                   linewidth=1, alpha=0.9))

# Projection label
ax1.text(47, 9, 'si tirages\ncontinuent', fontsize=8, color=TEXT_MUT,
         ha='center', va='center', fontstyle='italic', alpha=0.7)

# ═══════════ X AXIS ═══════════

all_ticks = [0, 6, 12, 18, 24, 30, 36, 42, 48]
all_labels = ['Oct\n2022','Avr\n2023','Oct\n2023','Avr\n2024','Oct\n2024',
              'Avr\n2025','Oct\n2025','Avr\n2026','Dec\n2026']
ax1.set_xticks(all_ticks)
ax1.set_xticklabels(all_labels, fontsize=7, color=TEXT_MUT)
ax1.set_xlim(-2, 52)

for s in ['top']: ax1.spines[s].set_visible(False)
ax1.spines['left'].set_color(TEXT)
ax1.spines['bottom'].set_color(BORDER)
ax1.spines['right'].set_visible(False)
ax2.spines['right'].set_color(PURPLE)
ax2.spines['top'].set_visible(False)
ax1.grid(axis='y', color=BORDER, linewidth=0.3, alpha=0.4)

# ═══════════ COMBINED LEGEND ═══════════

lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper center',
           fontsize=8, framealpha=0.95, edgecolor=BORDER, ncol=3)

# ═══════════ HEADER ═══════════

fig.text(0.08, 0.96, 'EONR', fontsize=26, fontweight='bold', color=NEG)
fig.text(0.175, 0.963, 'White Lion ELOC $150M — Death Spiral', fontsize=13,
         color=TEXT, fontweight='bold')
fig.text(0.88, 0.963, '12/100', fontsize=13, fontweight='bold', color=NEG, ha='right',
         bbox=dict(boxstyle='round,pad=0.3', facecolor=NEG_SOFT, edgecolor=NEG, linewidth=1))

# ═══════════ BOTTOM METRICS ═══════════

fig.text(0.08, 0.03, '$8.1M tires sur $150M (5.4%)  |  $141.9M restant  |  '
         'avg $0.58/share  |  expire dec 2026  |  going concern',
         fontsize=8.5, color=SLATE, fontweight='bold')
fig.text(0.88, 0.03, 'NE PAS TOUCHER', fontsize=10, fontweight='bold',
         color=NEG, ha='right',
         bbox=dict(boxstyle='round,pad=0.3', facecolor=NEG_SOFT, edgecolor=NEG, linewidth=1))
fig.text(0.88, 0.01, 'SEC CIK 1842556 | DailyTickers', fontsize=6, color=TEXT_LT, ha='right')

plt.savefig('/Users/marketwatchxyz/GolandProjects/articles/analyses/EONR/eonr_eloc_dashboard.png',
            dpi=200, facecolor=BG, edgecolor='none', bbox_inches='tight', pad_inches=0.3)
print('OK')
