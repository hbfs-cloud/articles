"""Exclusions par la nature de l'activité, lues dans les profils MCP (11_pool_quote_profile_*) des noms des groupes en tête
au 2026-11-04. Convention du dépôt (tools/lib/sharia-filter.js) : secteur Financial Services = finance à intérêt ou assurance
conventionnelle ; jeux d'argent ; assureurs santé ; maîtres d'œuvre de défense. Aucun ratio n'est calculé pour ces noms."""
NATURE_EXCLUDED = {
    'ONB': "banque conventionnelle à intérêt (Banks - Regional, Old National Bancorp d'après le profil MCP)",
    'WAL': "banque conventionnelle à intérêt (Banks - Regional, holding de Western Alliance Bank d'après le profil MCP)",
    'CFR': "banque conventionnelle à intérêt (Banks - Regional, Cullen/Frost Bankers d'après le profil MCP)",
    'CLBK': "banque conventionnelle à intérêt (Banks - Regional, Columbia Financial d'après le profil MCP)",
    'BOKF': "banque conventionnelle à intérêt (Banks - Regional, holding de BOKF, NA d'après le profil MCP)",
    'FHB': "banque conventionnelle à intérêt (Banks - Regional, holding de First Hawaiian Bank d'après le profil MCP)",
    'BOH': "banque conventionnelle à intérêt (Banks - Regional, Bank of Hawaii d'après le profil MCP)",
    'FHN': "banque conventionnelle à intérêt (Banks - Regional, First Horizon d'après le profil MCP)",
    'RNST': "banque conventionnelle à intérêt (Banks - Regional, holding de Renasant Bank d'après le profil MCP)",
    'RITM': "foncière hypothécaire et crédit (REIT - Mortgage, Rithm Capital : origination et service de prêts d'après le profil MCP)",
    'SEZL': "crédit au point de vente (Credit Services, Sezzle : crédit à la consommation d'après le profil MCP)",
    'ECPG': "rachat et recouvrement de créances de consommation (Credit Services, Encore Capital d'après le profil MCP)",
    'SPNT': "réassurance et assurance conventionnelles (Insurance - Reinsurance, SiriusPoint d'après le profil MCP)",
    'MTG': "assurance hypothécaire conventionnelle (Insurance - Specialty, MGIC : assurance de prêts immobiliers d'après le profil MCP ; déjà dans SHARIA_EXCLUDED du dépôt)",
    'ACT': "assurance hypothécaire conventionnelle (Insurance - Specialty, Enact : assurance de prêts immobiliers d'après le profil MCP)",
    'JXN': "assureur vie et rentes conventionnel (Insurance - Life, Jackson Financial : annuités fixes et variables d'après le profil MCP)",
    'FLUT': "jeux d'argent (Gambling, Flutter Entertainment : paris sportifs et jeux en ligne d'après le profil MCP)",
    'GLPI': "foncière bailleresse d'exploitants de casinos (REIT - Specialty, Gaming and Leisure Properties : biens loués à des opérateurs de jeux d'après le profil MCP)",
}
# Activité principale licite mais part de revenus impurs non mesurée et potentiellement > 5 % : conformité inconnue.
NATURE_UNKNOWN = {
    'CAKE': "restaurants avec service d'alcool (Cheesecake Factory) : part du chiffre d'affaires tirée de l'alcool non publiée par la source",
    'KMX': "segment CarMax Auto Finance (crédit automobile à intérêt, profil MCP) : part des revenus d'intérêt non mesurée",
    'STLA': "financement des clients et concessionnaires (retail and dealer financing services, profil MCP) : part des revenus d'intérêt non mesurée",
    'VAC': "financement des ventes de multipropriété (Marriott Vacations « develops, markets, sells, finances », profil MCP) : part des revenus d'intérêt non mesurée",
    'VVX': "services de soutien aux forces armées (V2X, clients de défense d'après le profil MCP) : part liée à l'armement non mesurée",
}
