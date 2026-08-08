'use strict';
/**
 * simulate.js — simule une ligne publiée contre les barres réelles, avec les règles du dépôt.
 *
 * REMPLISSAGE (leçon vwap-entry-gate) : entrée effective = min(ouverture, cours moyen pondéré)
 * bornée au plus bas de séance. Si l'ouverture dépasse le haut de zone de plus de 2%, la ligne
 * n'est prise QUE sur un repli au cours moyen pondéré ; au-delà, NON REMPLIE — jamais notée.
 * Faute de données intraséance, le cours moyen pondéré est approché par (H+B+C)/3. C'est une
 * approximation, elle est déclarée, et elle s'applique IDENTIQUEMENT aux deux méthodes comparées —
 * donc elle ne peut pas biaiser la comparaison, seulement le niveau absolu.
 *
 * SORTIE (leçon stop-exit-must-be-a-traded-price) : une sortie au stop n'est comptée que si le
 * stop a été RÉELLEMENT traité. Si la séance ouvre sous le stop et n'y revient jamais (plus haut
 * de séance < stop), la sortie se fait À L'OUVERTURE. Compter au stop inventerait un prix que le
 * marché n'a pas coté et flatterait mécaniquement le R.
 */

const CHASE_TOLERANCE_PCT = 2;

const vwapProxy = b => (b.h + b.l + b.c) / 3;

/**
 * @param {Array} bars   barres du ticker, croissantes, avec {d,o,h,l,c}
 * @param {string} scanDate  séance d'entrée (YYYY-MM-DD)
 * @param {object} lv    { entry_low, entry_high, stop, tp1, tp2, horizon }
 */
function simulate(bars, scanDate, lv) {
  const i0 = bars.findIndex(b => b.d >= scanDate);
  if (i0 < 0) return { status: 'NO_DATA' };
  const fwd = bars.slice(i0);
  if (!fwd.length) return { status: 'NO_DATA' };

  // ── Remplissage sur la première séance ────────────────────────────────────
  const d0 = fwd[0];
  const vw = vwapProxy(d0);
  let fill = null, fillKind = null;

  if (d0.o > lv.entry_high * (1 + CHASE_TOLERANCE_PCT / 100)) {
    // Ouverture trop haute : seulement sur repli au cours moyen pondéré, s'il est dans la zone
    if (vw <= lv.entry_high * (1 + CHASE_TOLERANCE_PCT / 100) && d0.l <= lv.entry_high) {
      fill = Math.max(vw, d0.l); fillKind = 'repli_vwap';
    } else {
      return { status: 'NON_REMPLI', reason: `ouverture ${d0.o.toFixed(2)} > haut de zone +2%` };
    }
  } else {
    fill = Math.min(d0.o, vw);
    fill = Math.max(fill, d0.l);              // borné au plus bas de séance
    fillKind = (fill > lv.entry_high) ? 'chase' : 'zone';
    if (fill > lv.entry_high * (1 + CHASE_TOLERANCE_PCT / 100)) {
      return { status: 'NON_REMPLI', reason: 'remplissage au-delà de la tolérance de chase' };
    }
  }

  const risk = fill - lv.stop;
  if (risk <= 0) return { status: 'INVALIDE', reason: 'stop au-dessus du remplissage' };

  // ── Parcours ──────────────────────────────────────────────────────────────
  const H = lv.horizon || 10;
  let mae = 0, mfe = 0;
  for (let k = 0; k < Math.min(H, fwd.length); k++) {
    const b = fwd[k];
    mae = Math.min(mae, (b.l - fill) / fill * 100);
    mfe = Math.max(mfe, (b.h - fill) / fill * 100);

    // Le stop d'abord : sur une séance qui touche les deux, on ne peut pas savoir l'ordre,
    // et compter la cible serait le biais optimiste classique.
    if (b.l <= lv.stop) {
      const traded = b.h >= lv.stop;          // le stop a-t-il été coté ?
      const px = traded ? lv.stop : b.o;      // sinon sortie à l'ouverture (leçon)
      return { status: 'STOP', exit: px, r: (px - fill) / risk, days: k + 1,
               fill, fillKind, mae, mfe, gapped: !traded };
    }
    if (b.h >= lv.tp1) {
      return { status: 'TP1', exit: lv.tp1, r: (lv.tp1 - fill) / risk, days: k + 1,
               fill, fillKind, mae, mfe, gapped: false };
    }
  }
  if (fwd.length < H) return { status: 'EN_COURS', days: fwd.length, fill, fillKind, mae, mfe };
  const last = fwd[Math.min(H, fwd.length) - 1];
  return { status: 'HORIZON', exit: last.c, r: (last.c - fill) / risk, days: H,
           fill, fillKind, mae, mfe, gapped: false };
}

module.exports = { simulate, vwapProxy, CHASE_TOLERANCE_PCT };
