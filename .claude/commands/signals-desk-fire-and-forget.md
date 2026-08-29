<!-- workflow-contract: signals-desk-fire-and-forget -->
# /signals-desk-fire-and-forget - Variante autonome sans raccourci de preuve

Cette variante utilise exactement les deux plans et `validate-trade-ideas.js` de
`/signals-desk`. Elle saute uniquement le rapport riche et l'analyse longue du ledger; elle ne saute
ni fraicheur, ni evidence, ni calcul, ni les trois revues. Elle applique
`.claude/skills/source-policy.md` sans exception.

```bash
node tools/validate-workflows.js --workflow signals-desk-fire-and-forget
bash tools/run-collect.sh signals-desk data/workflow-runs/signals-desk/YYYYMMDD/candidates \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD
```

Trier le vivier par score source, famille puis ticker, persister `selection.json`, puis verifier zero a
cinq survivants. Si la selection est vide, ecrire `no_setup` et ne pas lancer le plan verify.

```bash
bash tools/run-collect.sh signals-desk-verify data/workflow-runs/signals-desk/YYYYMMDD/verify \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD --var symbols=A,B,C
node tools/validate-trade-ideas.js data/workflow-runs/signals-desk/YYYYMMDD/ideas.json
```

Sorties autorisees:

- `ready`: 1 a 5 idees validees, digest autosuffisant.
- `no_setup`: zero idee, avec screen/regime prouves.
- echec MCP/fraicheur/evidence: aucun signal; rapporter la cause exacte sans reutiliser un ancien run.

Le web ne remplace aucun chiffre. Aucun univers crypto/forex n'est ajoute sans plan dedie. Les reviewers
utilisent le meme snapshot, sans refetch.

La sortie est locale par defaut. `--publish` autorise explicitement Telegram apres tous les gates;
`--substack-note` autorise separement une note anglaise apres un Telegram confirme. `dry-run` interdit
tous les effets externes. Un echec d'envoi reste un echec, sans fallback implicite. Aucun email implicite.
