"""Exclusions par la nature de l'activité, lues dans les profils MCP (11_pool_quote_profile_*) des noms des groupes en tête
au 2026-11-02. Convention du dépôt (tools/lib/sharia-filter.js) : secteur Financial Services = finance à intérêt ou assurance
conventionnelle ; jeux d'argent ; assureurs santé ; maîtres d'œuvre de défense. Aucun ratio n'est calculé pour ces noms."""
NATURE_EXCLUDED = {
    'BOKF': "banque conventionnelle à intérêt (Banks - Regional, holding de BOKF, NA d'après le profil MCP)",
    'WAL': "banque conventionnelle à intérêt (Banks - Regional, holding de Western Alliance Bank d'après le profil MCP)",
    'UMBF': "banque conventionnelle à intérêt (Banks - Regional, UMB Financial : banque commerciale et de détail d'après le profil MCP)",
    'BKU': "banque conventionnelle à intérêt (Banks - Regional, holding de BankUnited d'après le profil MCP)",
    'FHB': "banque conventionnelle à intérêt (Banks - Regional, holding de First Hawaiian Bank d'après le profil MCP)",
    'RNST': "banque conventionnelle à intérêt (Banks - Regional, holding de Renasant Bank d'après le profil MCP)",
    'VOYA': "assurance et épargne retraite conventionnelles (Financial Conglomerates, Voya : Retirement, Employee Benefits d'après le profil MCP)",
    'EQH': "assureur vie et retraite conventionnel (Asset Management selon la source ; segments Individual Retirement, Protection Solutions d'après le profil MCP)",
    'CRBG': "assureur vie et retraite conventionnel (Asset Management selon la source ; segments Individual Retirement, Life Insurance d'après le profil MCP)",
    'AGO': "assurance-crédit conventionnelle (Insurance - Specialty, Assured Guaranty : garantie financière des émissions publiques et structurées d'après le profil MCP)",
    'ACT': "assurance hypothécaire conventionnelle (Insurance - Specialty, Enact : assurance de prêts immobiliers d'après le profil MCP)",
    'MTG': "assurance hypothécaire conventionnelle (Insurance - Specialty, MGIC : assurance de prêts immobiliers d'après le profil MCP ; déjà dans SHARIA_EXCLUDED du dépôt)",
    'MCY': "assureur dommages conventionnel (Insurance - Property & Casualty, Mercury General : assurance automobile et habitation d'après le profil MCP)",
    'BWIN': "intermédiaire d'assurance conventionnelle (Insurance Brokers, Baldwin Insurance Group d'après le profil MCP)",
    'LAZ': "banque d'affaires et gestion d'actifs (Capital Markets, Lazard d'après le profil MCP) : secteur Financial Services exclu par la convention du dépôt",
    'JEF': "banque d'investissement et marchés de capitaux (Capital Markets, Jefferies d'après le profil MCP)",
    'SEZL': "crédit au point de vente (Credit Services, Sezzle : crédit à la consommation d'après le profil MCP)",
    'ECPG': "rachat et recouvrement de créances de consommation (Credit Services, Encore Capital d'après le profil MCP)",
    'RITM': "foncière hypothécaire et crédit (REIT - Mortgage, Rithm Capital : origination et service de prêts d'après le profil MCP)",
    'DKNG': "jeux d'argent (Gambling, DraftKings : paris sportifs et jeux en ligne d'après le profil MCP ; déjà dans SHARIA_EXCLUDED du dépôt)",
    'MOH': "assureur santé conventionnel (Healthcare Plans, Molina : plans Medicaid, Medicare et Marketplace d'après le profil MCP)",
    'DRS': "armement (Aerospace & Defense, Leonardo DRS : électronique et systèmes militaires d'après le profil MCP ; convention défense de SHARIA_EXCLUDED)",
    'KRMN': "armement (Aerospace & Defense, Karman : systèmes de charge utile, étages et propulsion pour missiles et lanceurs d'après le profil MCP ; convention défense de SHARIA_EXCLUDED)",
}
# Activité principale licite mais part de revenus impurs non mesurée et potentiellement > 5 % : conformité inconnue.
NATURE_UNKNOWN = {
    'CAKE': "restaurants avec service d'alcool (Cheesecake Factory) : part du chiffre d'affaires tirée de l'alcool non publiée par la source",
    'EAT': "restaurants avec bar (Chili's Grill & Bar, Maggiano's) : part du chiffre d'affaires tirée de l'alcool non publiée par la source",
    'EMBJ': "segment Defense & Security d'Embraer (profil MCP) : part du chiffre d'affaires d'armement non mesurée",
    'KMX': "segment CarMax Auto Finance (crédit automobile à intérêt, profil MCP) : part des revenus d'intérêt non mesurée",
}
