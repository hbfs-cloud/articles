'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..'),run='analyses/ALLR/_runs/20260919-update',rev=run+'/revision',data=run+'/data';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),bytes=p=>fs.readFileSync(path.join(root,p)),read=p=>JSON.parse(bytes(p)),write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const a={
  "meta": {
    "lang": "fr",
    "dir": "ltr",
    "level": "intermediate",
    "tags": [
      "us",
      "biotech",
      "oncology",
      "clinical-stage",
      "no-trade"
    ],
    "grade": "D",
    "date": "2026-09-19",
    "dateDisplay": "19 septembre 2026",
    "description": "ALLR : dossier clinique et financier au close du 18 septembre 2026. Aucun nouveau niveau ni ordre.",
    "ogDescription": "ALLR : efficacité clinique, financement et dilution à distinguer.",
    "version": 3,
    "lastMcpRefresh": "2026-09-19T20:00:03.224Z",
    "status": "no-trade",
    "levelsCloseDate": "2026-09-18",
    "levelsVerifiedAt": "2026-09-19T20:00:03.224Z",
    "assetType": "stock"
  },
  "header": {
    "ticker": "ALLR",
    "name": "Allarity Therapeutics",
    "exchange": "NASDAQ",
    "sector": "Biotechnologie",
    "price": 1.21,
    "changePct": 4.13,
    "badges": [
      {
        "text": "Phase 2 clinique",
        "color": "purple"
      },
      {
        "text": "NO TRADE",
        "color": "red"
      }
    ],
    "metrics": {
      "marketCap": "19,3 M$",
      "volume": "185,6 k",
      "beta": 0.563,
      "range52w": "0,77 $ – 1,84 $",
      "shortInterest": "0,75 % du flottant"
    },
    "halal": false,
    "halalStatus": "unknown"
  },
  "verdict": {
    "score": 18,
    "conviction": "Low",
    "bias": "Neutral",
    "confidence": "Confiance faible : sources de marché indispensables incomplètes",
    "summary": "ALLR reste une biotech clinique, sans revenu produit significatif, dont la valeur dépend d’un passage ordonné de la fabrication du stenoparib à des résultats cliniques lisibles et finançables. Le bilan au 30 juin sépare 16,982 M$ de trésorerie et 9,999 M$ de cash restreint; le flux opérationnel du premier semestre est de -7,057 M$. La direction indique disposer de ressources pour au moins douze mois, ce qui n’efface ni le besoin futur de capital ni le risque de dilution. Tumim ne représente pas du cash : il s’agit d’une facilité d’achat d’actions de 6,0 M$ dont 5,998 M$ restaient disponibles. Le SPAC annoncé demeure une proposition non effective, séparée d’ALLR. Avec RankBeta, options et VWAP intraday indisponibles, aucune géométrie de trade ne peut être honnêtement publiée.",
    "whyBuy": [
      "Le 10-Q isole 16,982 M$ de trésorerie libre au 30 juin, au lieu de confondre les 26,981 M$ incluant le cash restreint.",
      "Le flux opérationnel H1 de -7,057 M$ est inférieur aux 19,740 M$ de flux de financement de la période : la liquidité a été renforcée, sans démontrer une autosuffisance.",
      "Le protocole et la fabrication peuvent raccourcir le chemin vers un test clinique, mais la valeur dépend de données futures.",
      "Le brevet japonais du DRP protège une composante du diagnostic compagnon, sans constituer une approbation."
    ],
    "whyAvoid": [
      "Les 9,999 M$ restreints ne constituent pas de cash libre, alors que le passif courant totalise 28,579 M$.",
      "Tumim avait 5,998 M$ de capacité restante au 30 juin : les émissions se font avec décote VWAP et peuvent diluer.",
      "La dette comptable atteint 20,862 M$; Streeterville peut exiger des redemptions mensuelles allant jusqu’à 250 k$ selon le contrat.",
      "À 1,21 $ au close, la volatilité et le risque d’annonce clinique rendent un stop historique inutilisable sans données intraday."
    ],
    "controlChecklist": [
      {
        "label": "Close quotidien",
        "status": "pass",
        "statusLabel": "Certifié",
        "evidence": "300 séances jusqu’au 18 septembre.",
        "action": "Contexte descriptif seulement."
      },
      {
        "label": "RankBeta",
        "status": "blocked",
        "statusLabel": "HTTP 403",
        "evidence": "Transmission fournisseur indisponible.",
        "action": "Pas de validation finale."
      },
      {
        "label": "Options / VWAP",
        "status": "blocked",
        "statusLabel": "Indisponibles",
        "evidence": "Options absentes; 24/26 cellules intraday refusées.",
        "action": "Pas de niveau ni d’ordre."
      }
    ]
  },
  "business": {
    "overview": "<p>ALLR développe le stenoparib, un inhibiteur PARP/tankyrase, avec un diagnostic compagnon DRP destiné à identifier les patients susceptibles d’en tirer un bénéfice. Le modèle n’est pas commercial : au premier semestre 2026, le 10-Q ne rapporte que 25 k$ de services de licence DRP et aucun revenu au deuxième trimestre. Chaque étape de développement doit donc être lue avec le financement qui la rend possible.</p><p>La campagne de fabrication dite « Phase 3-ready » est un jalon industriel. Elle ne démontre ni un recrutement achevé, ni une réponse clinique, ni une approbation. Eisai est le concédant historique des droits sur stenoparib; le dossier ne le présente pas comme un client coté et ne lui attribue aucun revenu commercial.</p><p>La direction estime que le cash disponible finance les opérations pendant au moins douze mois depuis le 10-Q. Cette formulation n’est pas une conclusion actuelle de doute substantiel. Elle n’élimine pas le risque : le groupe a consommé 7,057 M$ dans l’exploitation sur six mois et les essais, la réglementation et les frais généraux restent consommateurs de capital.</p><p>Le vrai arbitrage est donc entre preuve clinique, calendrier et capital par action. Une hausse de cours sur un brevet ou une annonce de SPAC ne résout aucune de ces trois variables.</p>",
    "segments": [
      {
        "name": "Stenoparib / DRP",
        "revenue": "Pré-commercial",
        "pct": "N/A",
        "description": "Programme clinique et diagnostic compagnon."
      }
    ],
    "moat": "Le DRP et la protection du brevet peuvent améliorer la sélection de patients. Cette protection a une valeur conditionnelle : le diagnostic doit s’intégrer à un développement clinique utile, obtenir l’adoption requise et coexister avec un financement qui ne détruit pas la valeur par action.",
    "theme": "Oncologie clinique, diagnostic compagnon et financement des petites biotechs",
    "coverageMatrix": [
      {
        "facet": "Cours et barres quotidiennes",
        "status": "COUVERT",
        "decision": "300 séances continues au close du 18 septembre."
      },
      {
        "facet": "Comparables",
        "status": "COUVERT",
        "decision": "13 séries et statistiques locales reproductibles."
      },
      {
        "facet": "RankBeta",
        "status": "BLOQUÉ",
        "decision": "HTTP 403; pas de substitut."
      },
      {
        "facet": "Options et VWAP intraday",
        "status": "INDISPONIBLES",
        "decision": "Aucun niveau nouveau."
      }
    ],
    "sourceRefs": [
      {
        "name": "ALLR 10-Q",
        "url": "https://www.sec.gov/Archives/edgar/data/1860657/000143774926027830/allr20260630_10q.htm",
        "date": "2026-08-14"
      },
      {
        "name": "ALLR 8-K / brevet",
        "url": "https://www.sec.gov/Archives/edgar/data/1860657/000121390026100350/ea0305570018k.htm",
        "date": "2026-09-15"
      }
    ]
  },
  "news": [
    {
      "date": "2026-09-15",
      "title": "Brevet japonais pour le diagnostic DRP",
      "impact": "neutral",
      "detail": "Protection du diagnostic, sans approbation ni résultat clinique.",
      "source": "SEC",
      "sourceUrl": "https://www.sec.gov/Archives/edgar/data/1860657/000121390026100350/ea0305570018k.htm"
    },
    {
      "date": "2026-09-11",
      "title": "S-1 du SPAC Allarity Acquisition",
      "impact": "neutral",
      "detail": "IPO proposée, non effective; pas de cash ALLR.",
      "source": "SEC",
      "sourceUrl": "https://www.sec.gov/Archives/edgar/data/1860657/000121390026096825/ea0305408018k.htm"
    },
    {
      "date": "2026-08-14",
      "title": "Résultats Q2 et fabrication",
      "impact": "neutral",
      "detail": "Préparation industrielle, pas une validation clinique.",
      "source": "SEC/IR",
      "sourceUrl": "https://www.sec.gov/Archives/edgar/data/1860657/000143774926027830/allr20260630_10q.htm"
    }
  ],
  "fundamentals": {
    "rows": [
      {
        "metric": "Trésorerie libre",
        "value": "16,982 M$",
        "signal": "30 juin 2026",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Cash restreint",
        "value": "9,999 M$",
        "signal": "30 juin 2026",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Cash + restreint",
        "value": "26,981 M$",
        "signal": "30 juin 2026",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Actifs courants",
        "value": "31,729 M$",
        "signal": "30 juin 2026",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Passifs courants",
        "value": "28,579 M$",
        "signal": "30 juin 2026",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Dette comptable",
        "value": "20,862 M$",
        "signal": "30 juin 2026",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Notes convertibles",
        "value": "1,424 M$",
        "signal": "30 juin 2026",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Flux opérationnel H1",
        "value": "-7,057 M$",
        "signal": "six mois",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Flux financement H1",
        "value": "19,740 M$",
        "signal": "six mois",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Dépenses opérationnelles H1",
        "value": "5,384 M$",
        "signal": "six mois",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Perte nette H1",
        "value": "-6,155 M$",
        "signal": "six mois",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Revenus H1",
        "value": "25 k$",
        "signal": "services DRP",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Actions en circulation",
        "value": "15,910,724",
        "signal": "30 juin 2026",
        "signalColor": "blue",
        "note": "10-Q primaire.",
        "source": "10-Q 14 août 2026"
      },
      {
        "metric": "Capitalisation marché",
        "value": "19,25 M$",
        "signal": "close 18 septembre",
        "signalColor": "amber",
        "note": "10-Q primaire.",
        "source": "Snapshot marché"
      },
      {
        "metric": "Price/book fournisseur",
        "value": "5,45x",
        "signal": "snapshot fournisseur",
        "signalColor": "amber",
        "note": "Valorisation non utilisée : entreprise clinique déficitaire et revenu minimal.",
        "source": "Snapshot marché"
      },
      {
        "metric": "EV/revenus fournisseur",
        "value": "71,18x",
        "signal": "base revenue très faible; ratio non exploitable",
        "signalColor": "amber",
        "note": "Valorisation non utilisée : entreprise clinique déficitaire et revenu minimal.",
        "source": "Snapshot marché"
      }
    ],
    "sourceRefs": [
      {
        "name": "ALLR 10-Q — 14 août 2026",
        "url": "https://www.sec.gov/Archives/edgar/data/1860657/000143774926027830/allr20260630_10q.htm",
        "date": "2026-08-14"
      },
      {
        "name": "Snapshot marché ALLR — close 18 septembre 2026",
        "url": "https://mcp.dailytickers.com/",
        "date": "2026-09-19"
      }
    ]
  },
  "earnings": {
    "quarters": [],
    "nextEarnings": "Date non confirmée par l’émetteur dans les sources archivées.",
    "beatNote": "Le 10-Q du 14 août montre 0 $ de revenu au T2, 25 k$ de services de licence au S1, 5,384 M$ de dépenses opérationnelles et une perte nette S1 de 6,155 M$. L’émetteur ne fournit pas de guidance de revenus; l’horizon déclaré est une estimation de ressources sur au moins douze mois, pas une prévision de ventes.",
    "sourceRefs": [
      {
        "name": "ALLR 10-Q",
        "url": "https://www.sec.gov/Archives/edgar/data/1860657/000143774926027830/allr20260630_10q.htm",
        "date": "2026-08-14"
      }
    ]
  },
  "capitalStructure": {
    "sharesOutstanding": "15,91 M selon la source fournisseur; dénominateur de marché distinct du 10-Q",
    "dilutionRisk": "critical",
    "warrants": [
      {
        "series": "Tumim",
        "type": "Facilité d’achat conditionnelle",
        "shares": "Jusqu’à 6,0 M$; 5,998 M$ restant au 30 juin",
        "expiration": "Selon mécanisme contractuel",
        "note": "Capacité potentielle, pas du cash encaissé; prix dépendant du VWAP et décote."
      },
      {
        "series": "ALLN private warrants",
        "type": "SPAC proposée",
        "shares": "1,85 M / 1,925 M si surallocation",
        "strike": 1,
        "expiration": "À l’IPO proposée",
        "note": "Droit du SPAC, sous conditions; pas un titre ALLR ni cash ALLR."
      }
    ],
    "atm": {
      "active": false,
      "authorized": "ATM Ascendiant terminé",
      "used": "Historique",
      "remaining": "Aucune capacité ouverte établie"
    },
    "shareHistory": "Au 30 juin, 15 910 724 actions étaient en circulation et 19 124 363 émises. Le 10-Q indique 250 000 000 actions autorisées. Tumim permet au groupe, sans obligation, de céder jusqu’à 6,0 M$ d’actions; 5,998 M$ restaient disponibles. Cette capacité, distincte des notes Streeterville et de l’ATM Ascendiant entièrement utilisé puis terminé le 31 mars 2025, peut accroître le nombre d’actions si elle est tirée.",
    "sourceRefs": [
      {
        "name": "ALLR 10-Q",
        "url": "https://www.sec.gov/Archives/edgar/data/1860657/000143774926027830/allr20260630_10q.htm",
        "date": "2026-08-14"
      },
      {
        "name": "ALLR 8-K / SPAC",
        "url": "https://www.sec.gov/Archives/edgar/data/1860657/000121390026096825/ea0305408018k.htm",
        "date": "2026-09-11"
      }
    ]
  },
  "filingsReview": {
    "summary": "Dépôts et communiqués décisionnels locaux ouverts; ils ne constituent pas un inventaire exhaustif de toute émission future.",
    "filings": [
      {
        "date": "2026-08-14",
        "form": "10-Q",
        "accession": "Voir primaire local",
        "finding": "Cash, restricted cash, flux opérationnel, ligne Tumim et continuité.",
        "url": "https://www.sec.gov/Archives/edgar/data/1860657/000143774926027830/allr20260630_10q.htm"
      },
      {
        "date": "2026-09-11",
        "form": "8-K / Exhibit 99.1",
        "accession": "Voir primaire local",
        "finding": "SPAC proposée et horizon été 2028, conditionnels.",
        "url": "https://www.sec.gov/Archives/edgar/data/1860657/000121390026096825/ea0305408018k.htm"
      },
      {
        "date": "2026-09-15",
        "form": "8-K / Exhibit 99.1",
        "accession": "Voir primaire local",
        "finding": "Brevet japonais du DRP; pas d’approbation.",
        "url": "https://www.sec.gov/Archives/edgar/data/1860657/000121390026100350/ea0305570018k.htm"
      }
    ],
    "contrarianRisks": [
      "La facilité Tumim ne prouve pas des produits encaissés.",
      "Le SPAC proposé n’est ni effectif ni du cash ALLR.",
      "Le brevet ne démontre ni approbation ni efficacité.",
      "Le cash restreint peut être visé par les protections Streeterville; il ne doit pas être assimilé à une réserve libre.",
      "Le cash restreint peut être visé par les protections Streeterville; il ne doit pas être assimilé à une réserve libre."
    ]
  },
  "insiders": {
    "recentTransactions": [],
    "signal": "Aucune conclusion directionnelle n’est tirée d’une couverture incomplète.",
    "sourceRefs": [
      {
        "name": "Snapshot marché ALLR — close 18 septembre 2026",
        "url": "https://mcp.dailytickers.com/",
        "date": "2026-09-19"
      }
    ]
  },
  "shortInterest": {
    "siPct": "0,75 %",
    "daysToCover": "1,58",
    "trend": "Observation FINRA au 31 août, décalée du close de référence.",
    "sourceRefs": [
      {
        "name": "Snapshot marché ALLR — close 18 septembre 2026",
        "url": "https://mcp.dailytickers.com/",
        "date": "2026-09-19"
      }
    ]
  },
  "options": {
    "maturity": "Indisponible",
    "maxPain": "",
    "cpRatio": "",
    "unusual": "Aucune chaîne d’options disponible; aucune inférence de flux.",
    "sourceRefs": [
      {
        "name": "Snapshot marché ALLR — close 18 septembre 2026",
        "url": "https://mcp.dailytickers.com/",
        "date": "2026-09-19"
      }
    ]
  },
  "technicals": {
    "ema20": 1.2687,
    "ema50": 1.3051,
    "ema200": 1.3004,
    "rsi14": 41.97,
    "macd": -0.0479,
    "macdSignal": -0.0262,
    "atr14": 0.0998,
    "ma50Type": "EMA",
    "ma200Type": "EMA",
    "ma50Available": true,
    "ma200Available": true,
    "badges": [
      "Contexte quotidien",
      "Aucun déclencheur"
    ],
    "supports": [],
    "resistances": [],
    "setupNote": "Les indicateurs quotidiens sont descriptifs. Les séries sont continues, mais le VWAP intraday est refusé et aucun niveau, stop ou cible ne découle de ces chiffres.",
    "sourceRefs": [
      {
        "name": "Snapshot marché ALLR — close 18 septembre 2026",
        "url": "https://mcp.dailytickers.com/",
        "date": "2026-09-19"
      }
    ]
  },
  "performance": {
    "windowReturns": {
      "label": "Rendement de prix sur 21 séances, dividendes non réinvestis",
      "startDate": "2026-08-19",
      "endDate": "2026-09-18",
      "rows": [
        {
          "ticker": "ALLR",
          "returnPct": -15.38
        },
        {
          "ticker": "AZN",
          "returnPct": 0.69
        },
        {
          "ticker": "PFE",
          "returnPct": -2.05
        },
        {
          "ticker": "GSK",
          "returnPct": -5.03
        },
        {
          "ticker": "MRK",
          "returnPct": -3.5
        },
        {
          "ticker": "BMY",
          "returnPct": -6.73
        },
        {
          "ticker": "GILD",
          "returnPct": 1.7
        },
        {
          "ticker": "EXEL",
          "returnPct": 7.3
        },
        {
          "ticker": "BMRN",
          "returnPct": -7.77
        },
        {
          "ticker": "XBI",
          "returnPct": -7.57
        },
        {
          "ticker": "IBB",
          "returnPct": -5.72
        },
        {
          "ticker": "XLV",
          "returnPct": -4.15
        },
        {
          "ticker": "IWM",
          "returnPct": -5.84
        },
        {
          "ticker": "SPY",
          "returnPct": -0.96
        }
      ]
    },
    "sourceRefs": [
      {
        "name": "Snapshot marché ALLR — close 18 septembre 2026",
        "url": "https://mcp.dailytickers.com/",
        "date": "2026-09-19"
      }
    ]
  },
  "blastRadius": {
    "asOf": "2026-09-18",
    "observationTime": "2026-09-19T20:00:03.224Z",
    "window": "Du 23 mars au 18 septembre 2026",
    "methodology": "Rendements logarithmiques journaliers communs; corrélation de Pearson, β ALLR vs pair = cov(r_ALLR,r_pair)/var(r_pair), R² = corrélation²; rendements de prix sur 5 et 21 séances. Calcul local descriptif : RankBeta reste indisponible. Chaque série est alignée à la séance, puis les rendements logarithmiques sont corrélés; les comparables servent à situer le risque biotech et ne transforment jamais un événement de recherche ALLR en causalité sectorielle. Chaque série est alignée à la séance, puis les rendements logarithmiques sont corrélés; les comparables servent à situer le risque biotech et ne transforment jamais un événement de recherche ALLR en causalité sectorielle.",
    "groups": [
      {
        "name": "Pharma et oncologie",
        "order": 1,
        "transmission": "Comparaison de contexte et de co-mouvement; elle ne prouve ni contrat, ni causalité clinique.",
        "symbols": [
          {
            "ticker": "AZN",
            "role": "Leader oncology : exposition économique distincte : exposition économique distincte",
            "correlation": 0.0039,
            "beta": 0.0091,
            "r2": 0,
            "observations": 124,
            "return5d": 3.69,
            "return21d": 0.69,
            "relationClass": "leader",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          },
          {
            "ticker": "PFE",
            "role": "Big pharma / PARP : exposition économique distincte : exposition économique distincte",
            "correlation": 0.0852,
            "beta": 0.2823,
            "r2": 0.0073,
            "observations": 124,
            "return5d": -0.22,
            "return21d": -2.05,
            "relationClass": "upstream",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          },
          {
            "ticker": "GSK",
            "role": "Big pharma / oncology : exposition économique distincte : exposition économique distincte",
            "correlation": -0.0173,
            "beta": -0.0449,
            "r2": 0.0003,
            "observations": 124,
            "return5d": 4.34,
            "return21d": -5.03,
            "relationClass": "second_order",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          },
          {
            "ticker": "MRK",
            "role": "Leader oncology : exposition économique distincte : exposition économique distincte",
            "correlation": 0.0846,
            "beta": 0.1814,
            "r2": 0.0072,
            "observations": 124,
            "return5d": 2.04,
            "return21d": -3.5,
            "relationClass": "second_order",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          },
          {
            "ticker": "BMY",
            "role": "Oncologie : exposition économique distincte : exposition économique distincte",
            "correlation": 0.0382,
            "beta": 0.0952,
            "r2": 0.0015,
            "observations": 124,
            "return5d": -0.91,
            "return21d": -6.73,
            "relationClass": "second_order",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          },
          {
            "ticker": "GILD",
            "role": "Oncologie : exposition économique distincte : exposition économique distincte",
            "correlation": 0.0382,
            "beta": 0.1001,
            "r2": 0.0015,
            "observations": 124,
            "return5d": 4.45,
            "return21d": 1.7,
            "relationClass": "second_order",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          }
        ]
      },
      {
        "name": "Pairs biotech",
        "order": 1,
        "transmission": "Comparaison de contexte et de co-mouvement; elle ne prouve ni contrat, ni causalité clinique.",
        "symbols": [
          {
            "ticker": "EXEL",
            "role": "Pair oncologie : exposition économique distincte : exposition économique distincte",
            "correlation": 0.0926,
            "beta": 0.1741,
            "r2": 0.0086,
            "observations": 124,
            "return5d": 3.99,
            "return21d": 7.3,
            "relationClass": "direct_peer",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          },
          {
            "ticker": "BMRN",
            "role": "Biotech clinique : exposition économique distincte : exposition économique distincte",
            "correlation": 0.032,
            "beta": 0.0656,
            "r2": 0.001,
            "observations": 124,
            "return5d": -2.65,
            "return21d": -7.77,
            "relationClass": "second_order",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          }
        ]
      },
      {
        "name": "ETF santé",
        "order": 1,
        "transmission": "Comparaison de contexte et de co-mouvement; elle ne prouve ni contrat, ni causalité clinique.",
        "symbols": [
          {
            "ticker": "XBI",
            "role": "ETF biotechnologie sectoriel : exposition économique distincte : exposition économique distincte",
            "correlation": 0.1302,
            "beta": 0.2898,
            "r2": 0.017,
            "observations": 124,
            "return5d": 0.33,
            "return21d": -7.57,
            "relationClass": "sector_proxy",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          },
          {
            "ticker": "IBB",
            "role": "ETF biotechnologie sectoriel : exposition économique distincte : exposition économique distincte",
            "correlation": 0.1035,
            "beta": 0.2948,
            "r2": 0.0107,
            "observations": 124,
            "return5d": 0.8,
            "return21d": -5.72,
            "relationClass": "sector_proxy",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          },
          {
            "ticker": "XLV",
            "role": "ETF santé : exposition économique distincte : exposition économique distincte",
            "correlation": 0.055,
            "beta": 0.2159,
            "r2": 0.003,
            "observations": 124,
            "return5d": 1.83,
            "return21d": -4.15,
            "relationClass": "sector_proxy",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          }
        ]
      },
      {
        "name": "Risque petites capitalisations",
        "order": 2,
        "transmission": "Comparaison de contexte et de co-mouvement; elle ne prouve ni contrat, ni causalité clinique.",
        "symbols": [
          {
            "ticker": "IWM",
            "role": "ETF petites capitalisations : exposition économique distincte : exposition économique distincte",
            "correlation": 0.2925,
            "beta": 1.1332,
            "r2": 0.0855,
            "observations": 124,
            "return5d": -1.66,
            "return21d": -5.84,
            "relationClass": "second_order",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          }
        ]
      },
      {
        "name": "Marché large",
        "order": 2,
        "transmission": "Comparaison de contexte et de co-mouvement; elle ne prouve ni contrat, ni causalité clinique.",
        "symbols": [
          {
            "ticker": "SPY",
            "role": "Marché large : exposition économique distincte : exposition économique distincte",
            "correlation": 0.308,
            "beta": 1.576,
            "r2": 0.0949,
            "observations": 124,
            "return5d": -0.34,
            "return21d": -0.96,
            "relationClass": "second_order",
            "readThrough": "Son cours donne un contrôle de contexte; il ne valide ni l’efficacité de stenoparib, ni le financement, ni le calendrier propre à ALLR.",
            "confidence": "low",
            "eventRisk": "Résultats, essais et calendrier propres au titre; à confirmer par les sources de marché."
          }
        ]
      }
    ],
    "scenarios": [
      {
        "scenario": "bullish",
        "trigger": "Progrès clinique vérifiable et financement effectivement clos.",
        "firstOrder": "La visibilité du programme s’améliore.",
        "secondOrder": "Les comparables ne confirment que leurs propres moteurs.",
        "confirmation": "Données cliniques et termes de financement primaires.",
        "contradiction": "Retard, résultats non concluants ou dilution accrue."
      },
      {
        "scenario": "mixed",
        "trigger": "La préparation avance sans preuve d’efficacité décisive.",
        "firstOrder": "Le récit demeure, la valeur clinique reste ouverte.",
        "secondOrder": "Co-mouvements biotech hétérogènes.",
        "confirmation": "Recrutement sans résultats déterminants.",
        "contradiction": "Signal clinique clair et financé."
      },
      {
        "scenario": "bearish",
        "trigger": "Besoin de financement avant progrès clinique décisif.",
        "firstOrder": "Dilution et calendrier dominent.",
        "secondOrder": "Les ETF ne compensent pas le risque propre ALLR.",
        "confirmation": "Termes défavorables ou retard clinique.",
        "contradiction": "Capital clos et données substantielles."
      }
    ],
    "contradictions": [
      "Une corrélation ne démontre ni causalité clinique ni relation contractuelle.",
      "Eisai est le concédant historique; pas un client commercial documenté.",
      "Le brevet et la fabrication ne sont pas des résultats cliniques."
    ],
    "missingData": [
      "RankBeta : HTTP 403 fournisseur.",
      "Options indisponibles; VWAP intraday refusé.",
      "Aucun client coté documenté : aucun substitut artificiel."
    ],
    "sourceRefs": [
      {
        "name": "Snapshot marché ALLR — close 18 septembre 2026",
        "url": "https://mcp.dailytickers.com/",
        "date": "2026-09-19"
      }
    ]
  },
  "risks": {
    "riskScore": 10,
    "riskProfile": "Very High",
    "riskSummary": "Le profil combine burn opérationnel, notes et redemptions potentielles, risque de dilution Tumim, incertitude clinique et lacunes de données de marché. L’horizon de douze mois est une estimation de gestion, non une immunisation contre ces risques.",
    "riskCards": [
      {
        "title": "Financement et dilution",
        "severity": "critical",
        "points": [
          "Tumim reste une capacité conditionnelle à prix lié au VWAP, non du cash.",
          "L’ancien ATM est terminé; les mécanismes Streeterville et Tumim doivent rester séparés."
        ],
        "verdict": "Risque matériel : il empêche de transformer le récit en position de taille définie."
      },
      {
        "title": "Clinique",
        "severity": "critical",
        "points": [
          "La fabrication Phase 3-ready ne démontre ni recrutement ni efficacité.",
          "Le brevet protège le DRP, pas une approbation du stenoparib."
        ],
        "verdict": "Risque matériel : il empêche de transformer le récit en position de taille définie."
      },
      {
        "title": "SPAC",
        "severity": "high",
        "points": [
          "IPO 100 M$ / 115 M$ proposée, S-1 non effective.",
          "Le sponsor vise environ 25 % sous conditions; aucun produit n’est attribué à ALLR."
        ],
        "verdict": "Risque matériel : il empêche de transformer le récit en position de taille définie."
      },
      {
        "title": "Sources de marché",
        "severity": "high",
        "points": [
          "RankBeta HTTP 403.",
          "Options indisponibles et VWAP intraday refusé."
        ],
        "verdict": "Risque matériel : il empêche de transformer le récit en position de taille définie."
      }
    ],
    "pedagogy": "Pour le retail, le risque pertinent est le gap : une annonce clinique ou de financement peut faire traverser un stop. Sans VWAP, spread et profondeur valides, le montant risqué ne doit pas être fixé. Pas de poursuite après une hausse d’annonce; attendre une séance liquide, une donnée primaire et une nouvelle géométrie."
  },
  "tradeIdea": {
    "archiveReferenceClose": "2026-08-28",
    "entry": 1.39,
    "stop": 1.33,
    "tp1": 1.4919,
    "tp2": 1.5499,
    "stopPct": "Archive",
    "tp1Pct": "Archive",
    "tp2Pct": "Archive",
    "rr": "Archive uniquement",
    "status": "no-trade",
    "statusNote": "Niveaux historiques archivés et inactifs : aucun ordre, stop ou objectif n’est exécutable au close actuel.",
    "thesis": "Le retail ne doit pas chasser une annonce. Un nouveau contrat devrait partir d’une séance RTH complète, d’un spread observable, du VWAP, d’un montant de risque défini et d’un calendrier clinique/financement connu; ces conditions manquent aujourd’hui.",
    "catalysts": [
      "Résultat clinique ou recrutement documenté.",
      "Financement effectivement clos et termes rapprochés du dépôt le plus récent.",
      "Sources bloquées restaurées."
    ],
    "invalidation": [
      "Les niveaux historiques sont archivés et non exécutables.",
      "Un gap clinique ou financement peut franchir un stop sans exécution au prix attendu.",
      "Sans volume, spread, VWAP et sizing mis à jour, aucun ordre ne peut être construit."
    ]
  },
  "globalScore": {
    "keyTakeawaysPositive": [
      "Programme et diagnostic compagnon encore actifs.",
      "Trésorerie libre identifiée séparément du cash restreint.",
      "Protection du DRP étendue au Japon."
    ],
    "keyTakeawaysNegative": [
      "Burn opérationnel et besoins de financement restent déterminants.",
      "SPAC proposée et facilité Tumim ne sont pas du cash ALLR.",
      "Gates de marché obligatoires bloqués."
    ]
  },
  "disclaimer": "Révision locale au close certifié du 18 septembre 2026. Pas une recommandation, pas une attestation AQ finale, pas un ordre."
};

const raw={bars:read(data+'/bars.json'),comparison:read(data+'/comparison_bars.json'),fund:read(data+'/instrument.json'),tech:read(data+'/instrument.json'),short:read(data+'/short_squeeze.json'),status:read(data+'/status.json')};
const find=(o,type)=>{if(o&&typeof o==='object'){if(o.type===type)return o;for(const v of Object.values(o)){const r=find(v,type);if(r)return r;}}};
const bars=raw.bars.results[0].data[0].bars,f=find(raw.fund,'instrument_comprehensive_financial'),s=find(raw.fund,'instrument_comprehensive_stats'),t=find(raw.tech,'instrument_technicals'),ss=find(raw.short,'instrument_short_interest_series').points.at(-1);
if(bars.length!==300||bars.at(-1)[0]!=='2026-09-18')throw Error('Expected completed 300-session ALLR window');
const archivePath=rev+'/ALLR-archive-snapshot-20260828.json';
if(!fs.existsSync(path.join(root,archivePath)))write(archivePath,read('data/analyses-data/ALLR.json'));
const archive=read(archivePath);
(function(a,c){
 const {raw,bars,f,s,t,ss,archive,run,rev,data,root,read,write,bytes,sha}=c;
 const market=name=>({name:'Marketdata MCP : '+name,url:'https://mcp.dailytickers.com/mcp',date:'2026-09-19'});
 const docs=[
  ['2026-08-14','10-Q','0001437749-26-027830','ALLR-20260814-10Q.htm','https://www.sec.gov/Archives/edgar/data/1860657/000143774926027830/allr20260630_10q.htm','Le rapport sépare trésorerie libre et restreinte, décrit la consommation opérationnelle et distingue notes de dette, convertibles et facilité Tumim. Le financement dépend de mécanismes différents; aucun total entièrement dilué courant ne peut être obtenu en additionnant leurs plafonds.'],
  ['2026-09-11','Exhibit 99.1','0001213900-26-099576','ALLR-20260911-SPAC-SEC.htm','https://www.sec.gov/Archives/edgar/data/1860657/000121390026099576/ea030540801ex99-1.htm','Le communiqué daté de septembre annonce une IPO proposée du SPAC et une participation attendue du sponsor, sous conditions. Il réaffirme un horizon de financement antérieur; le produit proposé de l’IPO ne devient pas de la trésorerie ALLR.'],
  ['2026-09-15','Exhibit 99.1','0001213900-26-100350','ALLR-20260915-patent-SEC.htm','https://www.sec.gov/Archives/edgar/data/1860657/000121390026100350/ea030557001ex99-1.htm','Le communiqué décrit une protection japonaise du diagnostic compagnon. Le brevet peut protéger une propriété intellectuelle, mais ne valide ni le médicament, ni une efficacité comparative, ni une autorisation de commercialisation ou un financement des essais.'],
  ['2026-09-10','S-1','0001493152-26-042104','ALLN-20260910-S1.htm','https://www.sec.gov/Archives/edgar/data/2141983/000149315226042104/forms-1.htm','Le prospectus du SPAC décrit des engagements du sponsor et des warrants privés conditionnels à l’offre. Ces instruments appartiennent au SPAC; les sommes exposées et conflits possibles doivent être distingués du financement clinique et du capital ALLR.']
 ].map(([date,form,accession,file,url,finding])=>({date,form,accession,path:run+'/primary/'+file,url,finding,sha256:sha(bytes(run+'/primary/'+file))}));
 const ref=i=>({name:docs[i].form+' — '+(i===3?'SPAC ALLN':'ALLR'),url:docs[i].url,date:docs[i].date});
 const primary={kind:'primary_sec_manifest_v1',ticker:'ALLR',as_of:'2026-09-19',inventory_count:4,inventory_screened_count:4,opened_count:4,reviewed_count:4,decision_relevant_count:4,local_primary_count:4,documents:docs,review_scope:'Corpus décisionnel ciblé : comptes, financement, annonces de septembre et S-1 du SPAC. Pas inventaire exhaustif de tous les dépôts.'};
 a.header.price=bars.at(-1)[4];a.header.changePct=+(100*(bars.at(-1)[4]/bars.at(-2)[4]-1)).toFixed(2);
 a.header.metrics={marketCap:(bars.at(-1)[4]*s.sharesOutstanding/1e6).toFixed(2)+' M$',volume:(bars.at(-1)[5]/1e3).toFixed(1)+' k',beta:s.beta};
 for(const key of ['lastMcpRefresh','levelsVerifiedAt'])delete a.meta[key];
 a.meta.description='ALLR : risque clinique, trésorerie disponible et financement conditionnel. Aucun ordre actif.';
 a.verdict.whyBuy[3]='Le brevet japonais du DRP est annoncé avec une protection jusqu’en 2039; cette propriété intellectuelle ne démontre ni efficacité clinique ni approbation.';
 a.verdict.whyAvoid[2]='La note de dette comptable atteint 20,862 M$ hors convertibles. Les remboursements mensuels Streeterville jusqu’à 250 k$ sont conditionnels aux termes et à la période de démarrage du contrat.';
 a.verdict.controlChecklist[1].statusLabel='Fournisseur indisponible';
 a.verdict.controlChecklist[2].evidence='Options absentes et fenêtre intraday incomplète; aucune interpolation retenue.';
 a.business.coverageMatrix[2].decision='Fournisseur indisponible; classement élargi non remplacé par la sélection locale.';
 a.business.segments=[{name:'Stenoparib',description:'Programme clinique oncologique; pas de revenu produit commercial retenu.'},{name:'Diagnostic compagnon DRP',description:'Sélection de patients et services de licence; activité distincte d’une vente de médicament approuvé.'}];
 a.business.sourceRefs=[ref(0),ref(1),ref(2)];
 a.business.overview+='<p>Le SPAC ajoute un arbitrage de capital séparé de la clinique. Les engagements du sponsor sont conditionnels à l’offre, et les ressources exposées peuvent être perdues; le temps de la direction et les conflits d’intérêts font aussi partie du coût économique. L’IPO proposée ne constitue donc pas une rallonge de trésorerie clinique déjà disponible.</p>';
 a.earnings.beatNote+=' La prochaine date de résultats est non confirmée par l’émetteur dans les sources examinées. L’horizon de ressources dépend des dépenses futures, des essais et des termes de financement; il ne garantit aucun prix plancher pour l’action.';
 a.earnings.sourceRefs=[ref(0)];
 a.fundamentals.rows[5].metric='Note de dette, valeur comptable';
 a.fundamentals.rows[13]={metric:'Capitalisation de marché',value:(bars.at(-1)[4]*s.sharesOutstanding/1e6).toFixed(2)+' M$',signal:'Close 2026-09-18 × actions fournisseur',source:'Marketdata MCP : barres et statistiques',note:'Capitalisation, pas trésorerie ni valeur clinique.'};
 a.fundamentals.rows[14]={metric:'Price/book value fournisseur',value:s.priceToBook.toFixed(2)+'x',signal:'Snapshot collecté le 2026-09-19; période du book value non identifiée',source:'Marketdata MCP : statistiques',comparison:'Versus valeur comptable : ni les essais futurs ni leur probabilité de succès ne sont valorisés par ce dénominateur.',note:'Ratio descriptif; ce n’est pas une valeur liquidative ni un prix plancher.'};
 a.fundamentals.rows[15]={metric:'EV/revenus fournisseur',value:s.enterpriseToRevenue.toFixed(2)+'x',signal:'Enterprise value / revenus fournisseur; snapshot 2026-09-19, période comptable non identifiée',source:'Marketdata MCP : statistiques et fondamentaux',comparison:'Versus price/book : les revenus de services très faibles rendent ce multiple peu pertinent pour comparer des programmes cliniques.',note:'Aucun multiple EV/EBITDA positif ni objectif de cours : EBITDA fournisseur négatif et succès clinique non quantifiable ici.'};
 a.fundamentals.sourceRefs=[ref(0),market('fondamentaux et statistiques')];
 a.capitalStructure.shareHistory+=' Les actions propres ne sont pas des actions en circulation. Les rémunérations et conversions potentielles demandent un pont séparé : le total fully diluted courant reste indisponible, notamment pour les instruments à conversion variable et la facilité d’achat.';
 a.capitalStructure.sourceRefs=[ref(0),ref(3)];
 a.filingsReview.filings=docs.map(({date,form,accession,finding,url})=>({date,form,accession,finding,url}));
 a.filingsReview.contrarianRisks=[...new Set(a.filingsReview.contrarianRisks)];
 a.news=[
  {date:docs[2].date,title:'Protection japonaise du diagnostic compagnon',impact:'neutral',detail:'La propriété intellectuelle peut renforcer la protection du diagnostic, mais ne valide pas son utilité clinique prospective ni l’efficacité du médicament; le financement des essais reste nécessaire.',source:'SEC, communiqué daté',sourceUrl:docs[2].url},
  {date:docs[1].date,title:'SPAC : offre proposée et capital exposé',impact:'neutral',detail:'Le produit de l’offre proposée appartiendrait au SPAC. La participation attendue du sponsor et ses engagements conditionnels ne créent pas de cash libre pour financer immédiatement les essais ALLR.',source:'SEC, communiqué daté',sourceUrl:docs[1].url},
  {date:docs[0].date,title:'Comptes : liquidité et obligations distinctes',impact:'negative',detail:'La trésorerie restreinte sécurise des engagements et doit être séparée du cash disponible. La consommation opérationnelle et les termes de financement déterminent la marge de manœuvre clinique réelle.',source:'SEC, rapport trimestriel',sourceUrl:docs[0].url}
 ];
 for(const key of ['technicals','insiders','shortInterest','options','performance'])a[key].sourceRefs=[market(key)];
 a.social={platforms:[],sourceRefs:[market('sentiment non retenu faute de mesure qualifiée')]};
 a.shortInterest.siPct=ss.short_pct_float.toFixed(2)+' %';a.shortInterest.daysToCover=ss.days_to_cover.toFixed(2)+' jours';a.shortInterest.trend='FINRA : règlement au '+ss.settlement_date+', retardé par rapport à la clôture de référence.';
 const tm={ema20:'ema20',ema50:'ema50',ema200:'ema200',rsi14:'rsi',macd:'macd',macdSignal:'signal',atr14:'atr'};for(const[k,v]of Object.entries(tm))a.technicals[k]=+t[v].toFixed(4);
 a.risks.riskCards[1].title='Validation clinique';a.risks.riskCards[2].title='Capital du SPAC';
 a.risks.riskCards[3].points[0]='Classement élargi du fournisseur indisponible.';
 a.risks.pedagogy+=' Une publication de résultats cliniques ou une annonce de financement peut provoquer un gap avant toute possibilité de sortie. Le calendrier doit être recontrôlé juste avant une décision, et la taille limitée au budget de perte supportable.';
 a.tradeIdea.archiveReferenceClose=archive.meta.levelsCloseDate;
 for(const k of ['entry','stop','tp1','tp2','stopPct','tp1Pct','tp2Pct','rr'])a.tradeIdea[k]=archive.tradeIdea[k];
 a.tradeIdea.thesis+=' Les repères conservés ne permettent pas de conclure qu’une activation ou un stop ont réellement été exécutés; l’ancien prédicat n’a pas été rejoué. Attendre une validation clinique, financière et de marché suffisante avant toute nouvelle proposition.';
 a.disclaimer='Recherche locale à finalité éducative. Aucun ordre actif ni attestation finale de publication.';
 const links={
  AZN:['Leader de l’oncologie et des PARP','leader','Le portefeuille oncologique apporte un contexte thérapeutique, mais ses médicaments établis ne valident pas un résultat du stenoparib.'],
  PFE:['Concurrent thérapeutique dans les PARP','direct_peer','Le marché des inhibiteurs PARP constitue une comparaison thérapeutique; Pfizer n’est pas un fournisseur amont ALLR documenté.'],
  GSK:['Franchises oncologiques et inhibiteurs PARP','direct_peer','Le contexte concurrentiel dépend des indications et des données; aucune équivalence d’efficacité ou de calendrier clinique n’est déduite.'],
  MRK:['Grand laboratoire exposé à l’oncologie','second_order','Les tendances de traitement peuvent modifier le paysage concurrentiel sans relation directe avec le financement ou les essais ALLR.'],
  BMY:['Portefeuille diversifié de traitements oncologiques','second_order','Les résultats des grandes franchises servent de contexte sectoriel; leur diversification limite la comparaison avec une petite biotech clinique.'],
  GILD:['Oncologie au sein d’un groupe diversifié','second_order','Le sentiment oncologique peut toucher plusieurs titres, mais leurs produits, leurs risques cliniques et leurs besoins de capital diffèrent.'],
  EXEL:['Entreprise oncologique à produits commercialisés','second_order','Ce comparable éclaire le secteur oncologique tout en ayant des revenus établis; il ne fournit pas de multiple directement applicable à ALLR.'],
  BMRN:['Biopharma de maladies rares commercialisée','second_order','Le titre sert de contrôle biopharma hors oncologie; ses produits commercialisés et indications distinctes limitent fortement la comparabilité.'],
  XBI:['Panier large de valeurs biotechnologiques','sector_proxy','La variation du panier aide à isoler le facteur biotech, mais elle ne compense pas le risque binaire du programme ALLR.'],
  IBB:['Panier biotech à pondérations différentes','sector_proxy','Les poids des grandes sociétés modifient le signal sectoriel; comparer les paniers évite d’attribuer toute hausse biotech à la clinique ALLR.'],
  XLV:['Panier large du secteur santé','sector_proxy','Les laboratoires, services et autres segments de santé donnent un contrôle plus large et moins directement exposé aux petites biotechs.'],
  IWM:['Panier de petites capitalisations américaines','sector_proxy','Les conditions de liquidité et de financement des petites valeurs peuvent déplacer ALLR sans nouvelle efficacité clinique ni cash encaissé.'],
  SPY:['Contrôle du marché actions américain','sector_proxy','Le facteur de marché général sert de comparaison de prix; il ne neutralise ni dilution ni échéance clinique spécifique.' ]
 };
 const own=new Map(bars.map(b=>[b[0],b[4]])),comparisons=[];
 for(const item of raw.comparison.data.items[0].results[0].data){const common=item.bars.filter(b=>own.has(b[0])),x=[],y=[];for(let i=1;i<common.length;i++){x.push(Math.log(common[i][4]/common[i-1][4]));y.push(Math.log(own.get(common[i][0])/own.get(common[i-1][0])));}const mx=x.reduce((z,v)=>z+v,0)/x.length,my=y.reduce((z,v)=>z+v,0)/y.length;let xy=0,xx=0,yy=0;for(let i=0;i<x.length;i++){xy+=(x[i]-mx)*(y[i]-my);xx+=(x[i]-mx)**2;yy+=(y[i]-my)**2;}const correlation=xy/Math.sqrt(xx*yy);comparisons.push({ticker:item.symbol,correlation:+correlation.toFixed(4),beta:+(xy/xx).toFixed(4),r2:+(correlation*correlation).toFixed(4),observations:x.length,return5d:+(100*(common.at(-1)[4]/common.at(-6)[4]-1)).toFixed(2),return21d:+(100*(common.at(-1)[4]/common.at(-22)[4]-1)).toFixed(2)});}
 for(const g of a.blastRadius.groups)for(const r of g.symbols){const [role,relationClass,readThrough]=links[r.ticker];Object.assign(r,{role,relationClass,readThrough},comparisons.find(x=>x.ticker===r.ticker));r.eventRisk=relationClass==='sector_proxy'?'Taux, rééquilibrages et événements des principales positions peuvent modifier le panier.':'Résultats propres et annonces cliniques de '+r.ticker+' à vérifier séparément; aucun calendrier dégagé n’est déduit.';}
 a.blastRadius.observationTime=raw.status.captured_at;
 a.blastRadius.methodology='Calcul sur les dates communes des clôtures : rendements logarithmiques, corrélation de Pearson, bêta ALLR sur comparable égal à covariance divisée par variance du comparable, et R² égal à la corrélation au carré. Les rendements récents sont des variations de prix sans dividendes réinvestis. La méthode ne mesure ni causalité clinique ni probabilité de succès; le classement élargi reste indisponible.';
 a.blastRadius.missingData=['Classement élargi RankBeta indisponible.','Options indisponibles et fenêtre intraday incomplète.','Amont non représenté par un cours coté dans ce panier : Eisai est le concédant des droits documenté; aucun fournisseur coté ni client commercial n’est inventé pour remplir une classe.'];
 a.blastRadius.sourceRefs=[market('barres des comparables'),ref(0),ref(1)];
 a.blastRadius.scenarios[0].firstOrder='La réduction du risque clinique doit précéder toute révision de valeur; le financement doit permettre de poursuivre les essais.';
 a.blastRadius.scenarios[1].secondOrder='Les comparables suivent leurs propres produits et calendriers; le sentiment biotech peut diverger de la situation financière ALLR.';
 a.blastRadius.scenarios[1].confirmation='Des annonces de préparation ou de recrutement sans résultat clinique décisif maintiennent une forte incertitude.';
 a.blastRadius.scenarios[1].contradiction='Des données robustes et un financement effectivement sécurisé affaibliraient la lecture de simple progrès préparatoire.';
 a.blastRadius.scenarios[2].firstOrder='Le besoin de cash peut accroître la dilution avant que les essais ne réduisent le risque clinique.';
 a.blastRadius.scenarios[2].confirmation='Une émission défavorable, un retard de recrutement ou un résultat insuffisant doit documenter la dégradation.';
 a.blastRadius.scenarios[2].contradiction='Un financement clos sans dilution disproportionnée et des données substantielles contrediraient ce scénario de dégradation.';
 a.performance.windowReturns.rows=[{ticker:'ALLR',returnPct:+(100*(bars.at(-1)[4]/bars.at(-22)[4]-1)).toFixed(2)},...comparisons.map(x=>({ticker:x.ticker,returnPct:x.return21d}))];
 write(rev+'/primary-manifest.json',primary);write(rev+'/ALLR.json',a);
 (function(a,c){
 const {raw,bars,f,s,run,rev,data,root,read,write,bytes,sha,primary}=c;
 const esc=v=>String(v).replace(/~/g,'~0').replace(/\//g,'~1'),get=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
 const find=(o,type,p='')=>{if(o&&typeof o==='object'){if(o.type===type)return p;for(const[k,v]of Object.entries(o)){const r=find(v,type,p+'/'+esc(k));if(r!==undefined)return r;}}};
 const B='/results/0/data/0/bars',F=find(raw.fund,'instrument_comprehensive_financial'),S=find(raw.fund,'instrument_comprehensive_stats'),T=find(raw.tech,'instrument_technicals'),SH=find(raw.short,'instrument_short_interest_series');
 const J={ticker:'ALLR',score_components:{base:60,business:15,technical:3,capital:-20,source_gate:-15,clinical_risk:-25},judgments:{}};
 for(const p of ['meta.date','meta.dateDisplay','meta.version','verdict.score','risks.riskScore'])J.judgments[p]={value:get(a,p),reason:'Métadonnée ou jugement éditorial qualitatif explicite, distinct d’une mesure de marché et d’une probabilité.'};
 a.blastRadius.groups.forEach((g,i)=>J.judgments['blastRadius.groups.'+i+'.order']={value:g.order,reason:'Classement économique des groupes de comparaison, sans inférence de causalité clinique.'});write(rev+'/editorial-judgments.json',J);
 const inputs=[];for(const[name,file]of [['bars','bars'],['comparison','comparison_bars'],['fund','instrument'],['tech','instrument'],['short','short_squeeze'],['status','status']])inputs.push({name,path:data+'/'+file+'.json',sha256:sha(bytes(data+'/'+file+'.json'))});
 for(const[name,p,kind]of [['primary',rev+'/primary-manifest.json','primary_sec_manifest_v1'],['archive',rev+'/ALLR-archive-snapshot-20260828.json','archived_analysis'],['judgments',rev+'/editorial-judgments.json','editorial_judgment']])inputs.push({name,path:p,sha256:sha(bytes(p)),kind});
 const input=n=>inputs.find(x=>x.name===n),dep=(n,p)=>({input_path:input(n).path,input_sha256:input(n).sha256,source_pointer:p}),prov=(n,p,method,additional_inputs=[])=>({...dep(n,p),input_name:n,method,...(additional_inputs.length?{additional_inputs}:{})});
 const C=ticker=>{const i=raw.comparison.data.items[0].results[0].data.findIndex(x=>x.symbol===ticker);if(i<0)throw Error('Missing comparable '+ticker);return '/data/items/0/results/0/data/'+i+'/bars';};
 const primaryDoc=(i,method,more=[])=>prov('primary','/documents/'+i,method,more);
 function sourceFor(p){
  if(J.judgments[p])return prov('judgments','/judgments/'+esc(p)+'/value',J.judgments[p].reason);
  const ref=p.match(/^(.*)\.sourceRefs\.(\d+)\.(date|url|name)$/);if(ref){const r=get(a,ref[1]+'.sourceRefs.'+ref[2]);if(r.url==='https://mcp.dailytickers.com/mcp')return prov('status','/captured_at','Date de collecte pour attribution MCP, non date de marché.');const i=primary.documents.findIndex(x=>x.url===r.url);if(i<0)throw Error('Unknown primary URL');return primaryDoc(i,'Métadonnée bibliographique du document exact ouvert et haché.');}
  if(p==='meta.levelsCloseDate'||p==='blastRadius.asOf')return prov('bars',B+'/299/0','Dernière séance quotidienne complète.');
  if(p==='header.price')return prov('bars',B+'/299/4','Dernier close quotidien complet.');
  if(p==='header.changePct')return prov('bars',B+'/299/4','100 × (dernier close / close précédent − 1).',[dep('bars',B+'/298/4')]);
  if(p==='header.metrics.marketCap')return prov('bars',B+'/299/4','Close × actions courantes fournisseur, affiché en millions.',[dep('fund',S+'/sharesOutstanding')]);
  if(p==='header.metrics.volume')return prov('bars',B+'/299/5','Volume dernière séance affiché en milliers.');
  if(p==='header.metrics.beta')return prov('fund',S+'/beta','Bêta du snapshot fournisseur, distinct des régressions locales.');
  if(p==='header.badges.0.text')return primaryDoc(1,'Stade clinique déclaré dans le communiqué primaire, distinct d’une autorisation.');
  if(p==='verdict.summary'||/^verdict\.whyBuy\.[01]$/.test(p)||/^verdict\.whyAvoid\.[012]$/.test(p))return primaryDoc(0,'Comptes au 30 juin et contrats de financement : montants en millions, cash restreint séparé, capacités non encaissées.');
  if(p==='verdict.whyBuy.3')return primaryDoc(2,'Expiration du brevet japonais annoncée par l’émetteur; pas une approbation.');
  if(p==='verdict.whyAvoid.3')return prov('bars',B+'/299/4','Close de référence; risque de gap qualitatif, sans seuil exécutable.');
  if(p==='verdict.controlChecklist.0.evidence'||p.startsWith('business.coverageMatrix.0.'))return prov('bars',B,'300 séances continues et close de référence certifié.');
  if(p.startsWith('business.coverageMatrix.1.'))return prov('comparison','/data/items/0/results/0/data','Nombre de séries comparables réellement utilisées.');
  if(p.startsWith('business.overview'))return primaryDoc(0,'Comptes semestriels, activité et financement; préparation industrielle distincte du stade clinique.',[dep('primary','/documents/1')]);
  if(p.startsWith('earnings.'))return primaryDoc(0,'Tableau de résultats trimestriels/semestriels, ressources estimées et absence de date future confirmée.');
  const fm=p.match(/^fundamentals\.rows\.(\d+)\./);if(fm){const i=+fm[1];if(i<13)return primaryDoc(0,'Poste exact du bilan au 30 juin ou flux des six mois; chiffres en millions sauf revenus de services en milliers et actions unitaires.');if(i===13)return prov('bars',B+'/299/4','Capitalisation = close × actions; affichage en millions.',[dep('fund',S+'/sharesOutstanding')]);return prov('fund',S+'/'+(i===14?'priceToBook':'enterpriseToRevenue'),'Multiple du snapshot collecté; période comptable non identifiée, aucune juste valeur.',[dep('fund',F),dep('status','/captured_at')]);}
  if(p==='capitalStructure.sharesOutstanding')return prov('fund',S+'/sharesOutstanding','Actions courantes fournisseur en millions.');
  if(p==='capitalStructure.shareHistory'||p.startsWith('capitalStructure.warrants.0.'))return primaryDoc(0,'Bilan et contrat Tumim : actions émises/circulation, plafond de ligne et solde restant à juin; ATM historique terminé.');
  if(p.startsWith('capitalStructure.warrants.1.'))return primaryDoc(3,'Warrants privés et engagement conditionnel du sponsor du SPAC; aucun instrument ni cash ALLR assimilé.');
  if(/^filingsReview\.filings\.\d+\./.test(p))return primaryDoc(+p.split('.')[2],'Constat et référence du dépôt exact haché.');
  if(/^news\.\d+\./.test(p)){const i=primary.documents.findIndex(x=>x.url===a.news[+p.split('.')[1]].sourceUrl);return primaryDoc(i,'Date du communiqué ou rapport et conséquence économique attribuée.');}
  if(p.startsWith('shortInterest.'))return prov('short',SH+'/points/'+(c.ss?raw.short&&getShortCount()-1:0),'Dernier point FINRA disponible, short_pct_float déjà exprimé en pourcentage.');
  if(p.startsWith('technicals.'))return prov('tech',T,'Indicateur technique du fournisseur, non recalculé comme signal exécutable.');
  if(p.startsWith('performance.windowReturns.')){const m=p.match(/rows\.(\d+)/),ticker=m?a.performance.windowReturns.rows[+m[1]].ticker:'ALLR';return prov(ticker==='ALLR'?'bars':'comparison',ticker==='ALLR'?B:C(ticker),'Rendement simple de prix sur vingt et une séances; dates exactes de la fenêtre.');}
  if(p==='blastRadius.observationTime')return prov('status','/captured_at','Horodatage exact de la collecte.');
  if(p==='blastRadius.window')return prov('comparison',C('AZN'),'Dates de la fenêtre commune des séries quotidiennes.',[dep('bars',B)]);
  const bm=p.match(/^blastRadius\.groups\.(\d+)\.symbols\.(\d+)\./);if(bm){const r=a.blastRadius.groups[+bm[1]].symbols[+bm[2]];return prov('comparison',C(r.ticker),'Dates communes; log-rendements; Pearson, bêta ALLR sur comparable, carré de corrélation, observations et rendements cinq/vingt et une séances.',[dep('bars',B)]);}
  if(p==='risks.riskCards.1.points.0')return primaryDoc(0,'Fabrication phase suivante prête ne vaut pas passage réglementaire ou efficacité clinique.');
  if(p.startsWith('risks.riskCards.2.'))return primaryDoc(1,'Taille proposée de l’offre et participation attendue du sponsor, conditionnelles.',[dep('primary','/documents/3')]);
  if(p==='tradeIdea.archiveReferenceClose')return prov('archive','/meta/levelsCloseDate','Clôture de l’archive, non date éditoriale ni cours actuel.');
  if(/^tradeIdea\.(entry|stop|tp1|tp2)$/.test(p))return prov('archive','/'+p.replaceAll('.','/'),'Niveau historique inchangé, archive non exécutable.');
  if(/^tradeIdea\.(stopPct|tp1Pct|tp2Pct|rr)$/.test(p))return {...prov('archive','/tradeIdea','Géométrie de l’archive conservée et vérifiable.'),derivation:'archived_trade_geometry'};
  throw Error('Missing ALLR semantic mapping '+p);
 }
 function getShortCount(){let x=raw.short;for(const k of SH.slice(1).split('/'))x=x[k];return x.points.length;}
 const claims={},strings={},methods={};function walk(v,p=''){if(typeof v==='number'||typeof v==='string'&&/\d/.test(v)){claims[p]=sourceFor(p);methods[p]=claims[p].method;if(typeof v==='string')strings[p]=v;}else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))walk(x,p?p+'.'+k:k);}walk(a);
 const calc={kind:'deterministic_analysis_calculation_v1',ticker:'ALLR',reference_close:'2026-09-18',analysis_sha256:sha(bytes(rev+'/ALLR.json')),generator_path:'.agent/analyses-refresh-20260919/allr-revision/build-allr.cjs',generator_sha256:sha(bytes('.agent/analyses-refresh-20260919/allr-revision/build-allr.cjs')),inputs,score_components:J.score_components,valuation_scenario:{status:'non_applicable',reason_code:'NON_POSITIVE_EBITDA',reason:'EBITDA fournisseur observé négatif; aucun multiple positif ni objectif de prix calculé.',basis:dep('fund',F+'/ebitda')},values:a,string_numeric_claims:strings,methods,claim_provenance:claims,limitations:['RankBeta indisponible, options absentes, VWAP intraday refusé.','Amont coté non représenté : ne pas inventer un fournisseur.','Dilution potentielle variable non réconciliée; aucun ordre actif.']};
 write(rev+'/numeric-evidence.json',calc);write(rev+'/calculations.json',calc);const h=sha(bytes(rev+'/numeric-evidence.json'));
 write(rev+'/evidence.json',{ticker:'ALLR',reference_close:'2026-09-18',analysis_path:rev+'/ALLR.json',analysis_sha256:sha(bytes(rev+'/ALLR.json')),claims:Object.keys(claims).map(p=>({path:p,value:get(a,p),as_of:'2026-09-18',source_artifact:rev+'/numeric-evidence.json',source_sha256:h,source_pointer:typeof get(a,p)==='number'?'/values/'+p.split('.').map(esc).join('/'):'/string_numeric_claims/'+esc(p)}))});
 console.log('ALLR real semantic mappings: '+Object.keys(claims).length);
})(a,{...c,primary,comparisons});
 const {render,validate,SCHEMA}=require(require('path').join(root,'tools/render-analysis.js'));const errors=validate(a,SCHEMA);if(errors.length)throw Error(errors.join('; '));require('fs').writeFileSync(require('path').join(root,rev,'index.html'),render(a));
})(a,{raw,bars,f,s,t,ss,archive,run,rev,data,root,read,write,bytes,sha});
