# Échéancier — « Ce qui peut bouger la Bourse »

Format retenu par le propriétaire le 26 octobre 2026 pour décrire **les échéances et le calendrier dans
tous les contenus** : daily, weekly, analyse, scanner, et tout autre contenu qui parle de dates à venir
(rétrospective, séries, A+, playbook macro, réactions aux résultats, desk de signaux).

Une frise par semaine, en heures de Paris. Chaque rendez-vous est une pastille posée au-dessus ou
au-dessous du jour, reliée à l'axe par un pointillé :

- **la couleur** donne la famille : bleu = taux et macro, encre = résultats, ambre = géopolitique et
  matières premières, gris = séance (jour férié, échéance d'options, rééquilibrage), violet = vos lignes
  (entrée, sortie forcée, fin de plan) ;
- **le plein ou le contour** donne l'impact : plein = fort, contour = moyen. Un rendez-vous faible n'a
  pas sa place sur la frise ; il reste dans le tableau ou la prose ;
- **la fenêtre clé** surligne les jours où tout se joue, avec ses heures (« Fenêtre clé · mer. 19h00 →
  jeu. 21h00 ») ;
- **les chaînes à surveiller** disent ce qui se transmet à quoi, en si/alors : « Fed dure → Tech ↓ →
  Or ↓ ». Deux à quatre maillons, quatre chaînes au plus, aucun chiffre.

Sur téléphone, la frise devient un agenda vertical : seuls les jours qui portent un rendez-vous restent.

## Composant

| Élément | Fichier |
|---|---|
| Rendu HTML | `tools/lib/event-timeline.cjs` (`renderEventTimeline(spec)`) |
| Styles | `assets/report.css`, bloc `evt-tl` |
| Rendu des dates | `tools/lib/fr-calendar.js` (partagé avec le contrôle des claims) |
| Image pour Substack ou X | `node tools/render-timeline-png.js --article <page.html> --out <dossier>/_img/echeancier.png` |
| Tests | `node tools/test-event-timeline.js`, `node tools/test-content-claims.js` (A15) |

Le module refuse une spécification invalide au lieu de rendre une frise fausse : date hors fenêtre,
famille ou icône inconnue, impact faible, fenêtre de plus de trois semaines, fenêtre clé à cheval sur
deux semaines, lien externe, preuve absente quand elle est exigée.

```js
const { renderEventTimeline } = require('../../tools/lib/event-timeline.cjs');
const echeancier = renderEventTimeline({
  id: 'echeancier', asof: '2026-10-26', from: '2026-10-26', to: '2026-11-10',
  requireProof: true,                       // daily et weekly : obligatoire
  keyWindow: { from: '2026-10-28', to: '2026-10-29',
    labelHtml: `Fenêtre clé · mer. ${paris(fomc, 'tl_kw1')} → jeu. ${nyClose('tl_kw2')}` },
  events: [
    { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: 'tech, or',
      icon: 'bank', href: '#macro', proof: paris(fomc, 'tl_fed') },            // heure visible
    { date: '2026-10-28', category: 'earnings', impact: 'strong', label: 'Microsoft', detail: '+ Alphabet',
      icon: 'chip', href: '#earnings', proof: regDate('/facts/earnings/msft', 'msft_ir', 'tl_msft'),
      proofHidden: true },                                                     // date lue par les lecteurs d'écran
  ],
  chains: [{ steps: [{ label: 'Fed dure', icon: 'bank' },
    { label: 'Tech', category: 'earnings', icon: 'chip', tone: 'down' },
    { label: 'Or', icon: 'coin', tone: 'down' }] }],
});
```

Champs d'un événement : `date` (ISO, jour de Paris), `category` (`macro`, `earnings`, `geo`, `market`,
`plan`), `impact` (`strong`, `medium`), `label` (un ou deux mots), `detail` (ce que ça bouge, quelques
mots), `icon` (`bank`, `data`, `chip`, `company`, `vote`, `oil`, `magnet`, `ship`, `alert`, `hourglass`,
`closed`, `exit`, `entry`, `coin`, `gavel`, `globe`, `bolt`, `pill`, `cart`), `side` (`top`, `bottom`,
sinon automatique), `uncertain` (date annoncée mais non confirmée : contour pointillé et « ? »), `href`
(ancre interne), `proof` et `proofHidden`. Les événements d'un même jour se donnent dans l'ordre
chronologique.

## Règles éditoriales

1. **Un rendez-vous sans date vérifiée ne va pas sur la frise.** Il reste dans la prose, avec son
   incertitude écrite. Les sources admises sont celles des chiffres : flux collecté du run, registre
   `data/scheduled-events.json`, ou `primary-reference.json` de l'édition avec son autorité (Fed, BLS,
   BCE, IR de la société, dépôt SEC). Une date de résultats non confirmée par l'émetteur porte
   `uncertain: true`. Leçon du 2026-08-25 : un gap n'est pas une publication, vérifier la date.
2. **Heures de Paris, toujours.** Une annonce de 20h00 à New York tombe le lendemain à Paris : c'est ce
   lendemain que montre la frise. Les semaines de décalage d'heure d'été (fin mars, fin octobre) se
   disent en clair dans la prose.
3. **Fort ou moyen, rien d'autre.** Fort = peut déplacer l'indice ou le titre traité (Fed, CPI, emploi,
   PCE, résultats d'une mégacapitalisation ou du titre lui-même, sortie forcée d'une ligne). Moyen = peut
   déplacer un secteur ou une devise (BCE, BoJ, OPEP+, élection, résultats d'un pair).
4. **Une fenêtre clé au plus**, dans une semaine, quand les rendez-vous forts se concentrent. Ses bornes
   horaires sont des claims.
5. **Les chaînes disent un mécanisme, pas une prévision.** La note par défaut le rappelle : « Si/alors,
   pas une prévision. »
6. **Fenêtre utile, pas calendrier exhaustif** : de la date de la page à la fin de la période où la
   décision se joue, trois semaines au plus.

## Par contenu

| Contenu | Où | Fenêtre | Preuve |
|---|---|---|---|
| Weekly | section Agenda (4), avant le tableau détaillé | lundi couvert → mardi de la semaine suivante ou plus | `requireProof: true`, claims de date et d'heure |
| Daily | section Agenda du jour et de la semaine (7) | séance → vendredi suivant | `requireProof: true` |
| Scanner | section Contexte macro, automatique dans `tools/render-scanner.js` | séance d'entrée → sortie forcée de la ligne la plus longue | `macro_calendar` validé ; ajouter `date_iso`, `short`, `category`, `icon` par ligne, ou un objet `timeline` complet dans `data.json` |
| Analyse | bloc JSON `timeline` (schéma), rendu juste après le verdict | date de la fiche → fin d'horizon du plan | `source` obligatoire par événement ; exigé dès les fiches du 27 octobre 2026 |
| Autres contenus | là où la page parle des dates à venir | selon le sujet | même régime que la page |

## Contrôles

- `node tools/validate-content-claims.js <claims.json>` : chaque étiquette de jour est le rendu exact de
  sa date ISO ; chaque pastille porte un claim vérifié qui la date sur le jour de sa colonne, à Paris.
- `node tools/qa-content.js <page> --strict` : échéancier présent sur les daily, weekly et scanner datés
  du 27 octobre 2026 ou après ; étiquettes conformes sur toutes les pages.
- `node tools/check-analysis-editorial-quality.js --strict <fiche.json>` : bloc `timeline` présent et
  valide pour les fiches du 27 octobre 2026 ou après (ou `unavailableReason` explicite).

## Canaux

- **Site** : le composant HTML ci-dessus.
- **X et supports en français** : l'image produite par `tools/render-timeline-png.js`, découpée dans la
  page publiée (mêmes jours, mêmes heures), avec le vrai logo.
- **Substack** : il est en anglais, et l'image est en français. Pas d'image d'échéancier tant qu'il
  n'existe pas de rendu anglais ; les deux ou trois dates décisives s'écrivent en anglais dans le texte.
- **Telegram** : texte seul (règle en vigueur). Les deux ou trois rendez-vous décisifs s'écrivent en
  clair, jour et heure de Paris compris.
