# Plans historiques de collecte

Les fichiers `<sha256>.json` contiennent les octets exacts des plans employés par les collectes
historiques. Le validateur contrôle leur SHA-256 contre le journal et le harnais d'origine.
Les plans actifs, journaux et preuves de marché restent inchangés.

Récupération du 7 septembre 2026, depuis l'historique Git local :

| SHA-256 | Source Git | Collecte |
| --- | --- | --- |
| `11d33a234da9a859f88e3ac80d51500260cfbc53ced39d48c398a73a9747d67e` | `df7c3c92ddd478c9d413cb249c0a75420c6ac334:plans/daily.json` | daily du 1 septembre |
| `1ea7f3c285a028922a2a1e5c69919377eddffb3a593929eb48be1dbff868320e` | `0553cd7150698a494a06d65e468198e70a1832ca:plans/daily.json` | daily du 30 août |
| `9a67967502e3381b1501c07797ee8f5c64761878d0ef53e36a43a043171428db` | `bbffe187c82ef2448027852fb3b91867f758ab69:plans/weekly.json` | weekly du 31 août |
| `2ded2690c95752bc81a1a5c73c16001ca7b5c09aae7bbb985382107ea3115fa9` | `91b9a00b1db2cbfff1113d5c61932da2f7ad43af:plans/daily-focus.json` | focus daily du 30 août et du 1 septembre |
| `77d09cc6e00bb0f12166b2a6fc7fac468178b57058e647968ae0714f2e7554a4` | `bbffe187c82ef2448027852fb3b91867f758ab69:plans/weekly-focus.json` | focus weekly du 31 août |
| `5c5155d10a81ce17181a77c77b4753711360ecf2ff85df2bf16a78e0055b4eeb` | `bbffe187c82ef2448027852fb3b91867f758ab69:plans/analyse.json` | options AVGO citées dans le weekly du 31 août |

Cette récupération prouve la version du plan exécuté. Elle ne certifie pas à elle seule la véracité
des données ni la justesse de leur interprétation éditoriale.
