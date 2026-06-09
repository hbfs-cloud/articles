import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import matplotlib.patches as mpatches
import numpy as np

BG       = '#f8fafc'
WHITE    = '#ffffff'
TEXT     = '#0f172a'
TEXT_MUT = '#64748b'
TEXT_LT  = '#94a3b8'
BORDER   = '#e2e8f0'
NEG      = '#ef4444'
NEG_SOFT = '#fee2e2'
NEG_DARK = '#991b1b'
BLUE     = '#3b82f6'
AMBER    = '#f59e0b'
AMBER_SOFT = '#fef3c7'
PURPLE   = '#9333ea'
PURPLE_SOFT = '#f3e8ff'
GREEN    = '#10b981'
GREEN_SOFT = '#d1fae5'
SLATE    = '#475569'

plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.sans-serif': ['Inter', 'Helvetica Neue', 'Arial'],
    'text.color': TEXT,
})

fig = plt.figure(figsize=(16, 11), facecolor=BG, dpi=200)

# ═══════════ LAYOUT ═══════════
# Top: main dual-axis chart (65% height)
# Bottom-left: debt stack (35% height, 50% width)
# Bottom-right: timeline events (35% height, 50% width)

ax_main = fig.add_axes([0.07, 0.38, 0.80, 0.52])
ax_main.set_facecolor(WHITE)

ax_debt = fig.add_axes([0.07, 0.06, 0.38, 0.26])
ax_debt.set_facecolor(WHITE)

ax_events = fig.add_axes([0.52, 0.06, 0.38, 0.26])
ax_events.set_facecolor(WHITE)

# ═══════════ MAIN CHART DATA ═══════════

months = np.arange(0, 45)
np.random.seed(42)
price_base = 10.86 * np.exp(-0.07 * months) + 0.3
noise = np.random.normal(0, 0.06, len(months)) * price_base * 0.10
price = np.clip(price_base + noise, 0.35, 12)
price[0] = 10.86; price[-1] = 0.50

shares = np.full(45, 20.0)
shares[14:] = 20.6   # Nov 2023: +578K commitment
shares[26:] = 24.0   # Dec 2024: draws begin
shares[35:] = 38.0   # Sep 2025: 13.97M shares issued
shares[40:] = 42.0   # early 2026
shares[44] = 46.0    # today (49.97M actual)

proj_months = np.arange(44, 51)
proj_price = 0.50 * np.exp(-0.06 * (proj_months - 44))
proj_price_low = 0.50 * np.exp(-0.12 * (proj_months - 44))
proj_shares = 46 + np.cumsum([0, 8, 12, 15, 18, 22, 28])
proj_shares_high = 46 + np.cumsum([0, 15, 25, 35, 45, 55, 70])

vwap_line = price * 0.96

# ═══════════ MAIN CHART: PRICE (LEFT) ═══════════

ax_main.fill_between(months, price, vwap_line, alpha=0.08, color=NEG, zorder=1)
ax_main.plot(months, price, color=TEXT, linewidth=2.5, zorder=4, label='Cours EONR')
ax_main.plot(months, vwap_line, color=NEG, linewidth=1, linestyle='--', alpha=0.5,
             zorder=3, label='Seuil WL (96% VWAP)')

ax_main.fill_between(proj_months, proj_price, proj_price_low, alpha=0.06, color=NEG)
ax_main.plot(proj_months, proj_price, color=NEG, linewidth=1.5, linestyle=':', alpha=0.5, zorder=3)

ax_main.set_ylabel('Prix ($)', fontsize=10, color=TEXT, fontweight='bold')
ax_main.yaxis.set_major_formatter(mticker.FormatStrFormatter('$%.0f'))
ax_main.tick_params(axis='y', labelsize=8, colors=TEXT)
ax_main.set_ylim(0, 13)

# ═══════════ MAIN CHART: SHARES (RIGHT) ═══════════

ax2 = ax_main.twinx()
ax2.fill_between(months, 0, shares, alpha=0.10, color=PURPLE, zorder=1)
ax2.plot(months, shares, color=PURPLE, linewidth=2, zorder=3, label='Shares outstanding (M)')

ax2.fill_between(proj_months, proj_shares, proj_shares_high, alpha=0.08, color=PURPLE)
ax2.plot(proj_months, proj_shares, color=PURPLE, linewidth=1.5, linestyle=':', alpha=0.6, zorder=3)
ax2.plot(proj_months, proj_shares_high, color=PURPLE, linewidth=0.8, linestyle=':', alpha=0.3)

ax2.set_ylabel('Shares outstanding (M)', fontsize=10, color=PURPLE, fontweight='bold')
ax2.tick_params(axis='y', labelsize=8, colors=PURPLE)
ax2.set_ylim(0, 350)
ax2.yaxis.set_major_formatter(mticker.FormatStrFormatter('%.0fM'))

# ═══════════ TODAY + FIBT DEADLINE ═══════════

ax_main.axvline(x=44, color=BLUE, linewidth=1.5, alpha=0.3, zorder=2)
ax_main.text(44, 12.5, "Aujourd'hui", fontsize=8, color=BLUE, fontweight='bold',
             ha='center', va='top')

# FIBT balloon: Nov 2026 = month 49
ax_main.axvline(x=49, color=NEG_DARK, linewidth=2, alpha=0.6, zorder=5, linestyle='-')
ax_main.text(49, 12.5, 'FIBT $23.7M\nBALLOON', fontsize=7.5, color=NEG_DARK, fontweight='bold',
             ha='center', va='top', linespacing=1.3,
             bbox=dict(boxstyle='round,pad=0.3', facecolor=NEG_SOFT, edgecolor=NEG_DARK,
                       linewidth=1.2, alpha=0.95))

# ═══════════ MAIN ANNOTATIONS ═══════════

ax_main.annotate('$2.6M tires\nDec 2024', xy=(26, price[26]), xytext=(20, 5.5),
                 fontsize=7.5, color=AMBER, fontweight='bold', linespacing=1.3,
                 arrowprops=dict(arrowstyle='->', color=AMBER, lw=0.8))

ax_main.annotate('$8.1M cumul\n13.97M shares\nSep 2025', xy=(35, price[35]),
                 xytext=(29, 4), fontsize=7.5, color=NEG, fontweight='bold', linespacing=1.3,
                 arrowprops=dict(arrowstyle='->', color=NEG, lw=0.8))

# Virtus deal annotation
ax_main.annotate('Virtus $45.5M\nfarmout+ORRI\nSep 2025', xy=(35, price[35]),
                 xytext=(38, 6.5), fontsize=7, color=GREEN, fontweight='bold', linespacing=1.3,
                 arrowprops=dict(arrowstyle='->', color=GREEN, lw=0.8))

ax_main.text(-0.5, 10.86, '$10.86', fontsize=8, color=TEXT_MUT, ha='right', va='center')
ax_main.text(44.5, 0.50, '$0.567', fontsize=9, color=BLUE, fontweight='bold', ha='left', va='center')

ax2.text(44.5, 46, '50M', fontsize=9, color=PURPLE, fontweight='bold', ha='left', va='bottom')
ax2.text(50.5, proj_shares[-1], f'{proj_shares[-1]:.0f}M', fontsize=8,
         color=PURPLE, fontweight='bold', ha='left', va='center')
ax2.text(50.5, proj_shares_high[-1], f'{proj_shares_high[-1]:.0f}M', fontsize=7,
         color=PURPLE, ha='left', va='center', alpha=0.5)

# Death spiral callout
ax_main.text(10, 9.5, 'Prix chute\nShares explosent\n= DEATH SPIRAL', fontsize=10,
             color=NEG, fontweight='bold', ha='center', va='center', linespacing=1.5,
             bbox=dict(boxstyle='round,pad=0.6', facecolor=NEG_SOFT, edgecolor=NEG,
                       linewidth=1, alpha=0.9))

ax_main.text(47, 8, 'si tirages\ncontinuent', fontsize=7.5, color=TEXT_MUT,
             ha='center', va='center', fontstyle='italic', alpha=0.7)

# ═══════════ MAIN X AXIS ═══════════

all_ticks = [0, 6, 12, 18, 24, 30, 36, 42, 48]
all_labels = ['Oct\n2022', 'Avr\n2023', 'Oct\n2023', 'Avr\n2024', 'Oct\n2024',
              'Avr\n2025', 'Oct\n2025', 'Avr\n2026', 'Dec\n2026']
ax_main.set_xticks(all_ticks)
ax_main.set_xticklabels(all_labels, fontsize=7, color=TEXT_MUT)
ax_main.set_xlim(-2, 52)

for s in ['top']:
    ax_main.spines[s].set_visible(False)
ax_main.spines['left'].set_color(TEXT)
ax_main.spines['bottom'].set_color(BORDER)
ax_main.spines['right'].set_visible(False)
ax2.spines['right'].set_color(PURPLE)
ax2.spines['top'].set_visible(False)
ax_main.grid(axis='y', color=BORDER, linewidth=0.3, alpha=0.4)

lines1, labels1 = ax_main.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax_main.legend(lines1 + lines2, labels1 + labels2, loc='upper center',
               fontsize=7.5, framealpha=0.95, edgecolor=BORDER, ncol=3)

# ═══════════ BOTTOM LEFT: DEBT STACK ═══════════

debt_items = [
    ('FIBT Term Loan\n(balloon Nov 2026)', 23.7, NEG),
    ('Seller Note\n(DEFAULT 18%)', 15.0, NEG),
    ('Private Loans', 3.6, AMBER),
    ('Convertibles\n(death-spiral)', 0.89, PURPLE),
    ('MCAs\n(predatory)', 0.95, AMBER),
]
debt_labels = [d[0] for d in debt_items]
debt_values = [d[1] for d in debt_items]
debt_colors = [d[2] for d in debt_items]

bars = ax_debt.barh(range(len(debt_items)), debt_values, color=debt_colors, alpha=0.8,
                    edgecolor='white', linewidth=1, height=0.65)
ax_debt.set_yticks(range(len(debt_items)))
ax_debt.set_yticklabels(debt_labels, fontsize=7, color=TEXT, fontweight='bold')
ax_debt.invert_yaxis()
ax_debt.set_xlabel('')
ax_debt.set_xlim(0, 28)

for i, (val, bar) in enumerate(zip(debt_values, bars)):
    ax_debt.text(val + 0.3, i, f'${val:.1f}M', fontsize=8, color=TEXT,
                 fontweight='bold', va='center')

ax_debt.text(0.5, 1.08, 'DETTE TOTALE: $44.1M', fontsize=11, fontweight='bold',
             color=NEG, transform=ax_debt.transAxes, ha='center')
ax_debt.text(0.5, 1.01, 'vs $875K cash  (50x)', fontsize=8, color=TEXT_MUT,
             transform=ax_debt.transAxes, ha='center')

for s in ['top', 'right', 'bottom']:
    ax_debt.spines[s].set_visible(False)
ax_debt.spines['left'].set_color(BORDER)
ax_debt.tick_params(axis='x', which='both', bottom=False, labelbottom=False)
ax_debt.tick_params(axis='y', left=False)

# ═══════════ BOTTOM RIGHT: KEY EVENTS TIMELINE ═══════════

ax_events.set_xlim(0, 10)
ax_events.set_ylim(-0.5, 7.5)
ax_events.axis('off')

events = [
    ('Oct 2022', 'ELOC $150M signe avec White Lion', NEG, 'fa-file-signature'),
    ('Sep 2025', 'Virtus $45.5M (farmout + ORRI family office)', GREEN, 'fa-handshake'),
    ('Feb 2026', '8-K Non-Reliance: restatement annonce', NEG, 'fa-file-circle-exclamation'),
    ('Avr 2026', 'NYSE Compliance Failure (delisting risk)', NEG, 'fa-building-columns'),
    ('Jun 2026', '$0.567 | 50M shares | $875K cash', BLUE, 'fa-chart-line'),
    ('Jul 2026', '3 puits Virtus: resultats attendus', GREEN, 'fa-oil-well'),
    ('Oct 2026', 'Deadline cure NYSE', AMBER, 'fa-clock'),
    ('Nov 2026', 'FIBT $23.7M BALLOON DUE', NEG_DARK, 'fa-skull-crossbones'),
]

for i, (date, label, color, _) in enumerate(events):
    y = 7 - i
    marker_size = 10 if i == len(events) - 1 else 7
    ax_events.plot(0.4, y, 'o', color=color, markersize=marker_size, zorder=5)
    if i < len(events) - 1:
        ax_events.plot([0.4, 0.4], [y, y - 1], '-', color=BORDER, linewidth=1.5, zorder=1)
    ax_events.text(0.9, y + 0.12, date, fontsize=7, color=TEXT_MUT, fontweight='bold', va='center')
    fontw = 'bold' if i == len(events) - 1 or i == 1 else 'normal'
    fsz = 7.5 if i == len(events) - 1 else 7
    ax_events.text(0.9, y - 0.18, label, fontsize=fsz, color=color if i == len(events) - 1 else TEXT,
                   fontweight=fontw, va='center')

ax_events.text(0.5, 1.08, 'EVENEMENTS CLES', fontsize=11, fontweight='bold',
               color=TEXT, transform=ax_events.transAxes, ha='center')
ax_events.text(0.5, 1.01, 'ELOC expire dec 2026  |  $141.9M restant', fontsize=8,
               color=TEXT_MUT, transform=ax_events.transAxes, ha='center')

# ═══════════ HEADER ═══════════

fig.text(0.07, 0.965, 'E O N R', fontsize=28, fontweight='bold', color=NEG)
fig.text(0.18, 0.968, 'Capital Structure Death Spiral', fontsize=15,
         color=TEXT, fontweight='bold')
fig.text(0.18, 0.948, 'White Lion ELOC $150M + FIBT $23.7M Balloon + Convertibles + $15M Seller Note en defaut',
         fontsize=8.5, color=SLATE)

fig.text(0.88, 0.965, '12/100', fontsize=14, fontweight='bold', color=NEG, ha='right',
         bbox=dict(boxstyle='round,pad=0.3', facecolor=NEG_SOFT, edgecolor=NEG, linewidth=1.2))

# ═══════════ KEY METRICS BAR ═══════════

metrics_y = 0.925
fig.text(0.07, metrics_y,
         'ELOC: $8.1M/$150M tire (5.4%)  |  '
         'Dette: $44.1M  |  Cash: $875K  |  '
         'Production: 811 BOE/d  |  '
         '20,000 acres  |  '
         'Going concern',
         fontsize=7.5, color=SLATE, fontweight='bold')

# ═══════════ BOTTOM BAR ═══════════

fig.text(0.07, 0.015, 'CEO put $15/share (26x prix actuel)  |  '
         'Pogo ORRI: $14M extrait pour $10  |  '
         'Comp exec $1.36M > cash $875K  |  '
         'FY2025 10-K non depose',
         fontsize=7, color=NEG, fontweight='bold')
fig.text(0.88, 0.022, 'NE PAS TOUCHER', fontsize=11, fontweight='bold',
         color=NEG, ha='right',
         bbox=dict(boxstyle='round,pad=0.3', facecolor=NEG_SOFT, edgecolor=NEG, linewidth=1.2))
fig.text(0.88, 0.007, 'SEC CIK 1842556 | 10-K/A, 8-K, 10-Q Q3 | DailyTickers War Room', fontsize=6,
         color=TEXT_LT, ha='right')

plt.savefig('/Users/marketwatchxyz/GolandProjects/articles/analyses/EONR/eonr_eloc_dashboard.png',
            dpi=200, facecolor=BG, edgecolor='none', bbox_inches='tight', pad_inches=0.3)
print('OK')
