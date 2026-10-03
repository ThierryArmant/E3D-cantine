// ==========================================================================
// A.B.C. – Assiette Bas Carbone : serveur Google Apps Script (version 3)
// Ce fichier NE CONTIENT NI clé API NI identifiants de tableurs.
//  - Clé Gemini      : Propriétés du script > GEMINI_KEY   (voir configurerCle)
//  - Annuaire écoles : tableur central (propriété ANNUAIRE_SHEET_ID) ou, à défaut,
//                      la constante ANNUAIRE_ECOLES ci-dessous.
// ==========================================================================
const NOM_MODELE_GEMINI = "gemini-3.5-flash";
const URL_REFERENTIEL = "https://raw.githubusercontent.com/ThierryArmant/E3D-cantine/main/plan_alimentaire_reference.txt";

// Valeurs par défaut des paramètres de chaque établissement (modifiables dans l'onglet "Parametres" de son tableur)
const PARAMETRES_DEFAUT = [
  // Base : plan alimentaire départemental, grammages de référence collège / adolescents (fichier plan_alimentaire_reference.txt)
  ["portion_entree_g", 80, "Entrée (g) - référence collège : crudités 60 à 80, salades composées 100 à 120"],
  ["portion_plat_g", 100, "Plat protidique (g) - référence collège : viande, volaille, poisson cuits 80 à 100 (hors garniture)"],
  ["portion_garniture_g", 150, "Garniture (g) - référence collège : féculents cuits 150 à 180, légumes cuits 100 à 120"],
  ["portion_dessert_g", 100, "Dessert ou laitage (g) - référence collège : pâtisserie 80 à 100, compote 100 à 120, yaourt 125"],
  ["portion_fruit_g", 150, "Fruit frais (g) - référence collège : 150 à 180"],
  ["portion_pain_g", 50, "Pain (g) - référence collège : 40 à 50 par repas"],
  ["effectif_defaut", 450, "Effectif attendu par défaut (couverts)"],
  ["prix_kg_eur", 4.5, "Coût moyen de la denrée (€/kg)"]
];

// Secours si aucun annuaire central n'est configuré : { "NOM ÉTABLISSEMENT": "ID_DU_TABLEUR" }
const ANNUAIRE_ECOLES = {
  // "COLLEGE EXEMPLE": "ID_GOOGLE_SHEET"
};

// ==========================================================================
// CLÉ GEMINI (jamais dans le code)
// ==========================================================================
function getCleGemini() {
  const k = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY");
  if (!k) throw new Error("Clé Gemini non configurée (propriété GEMINI_KEY).");
  return k;
}

// ▶️ À exécuter UNE SEULE FOIS depuis l'éditeur : colle ta clé, exécute, puis EFFACE-la du code.
function configurerCle() {
  const MA_CLE = "COLLE_TA_CLE_ICI";
  if (MA_CLE === "COLLE_TA_CLE_ICI") throw new Error("Colle d'abord ta clé dans la variable MA_CLE.");
  PropertiesService.getScriptProperties().setProperty("GEMINI_KEY", MA_CLE);
}

// ==========================================================================
// ANNUAIRE DES ÉTABLISSEMENTS
// ==========================================================================
function normaliserNomEcole(nom) {
  return String(nom || "").replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim().toUpperCase();
}

// Retourne { NOM_NORMALISÉ: { nom, id } } pour les établissements actifs ayant un tableur.
function getAnnuaire() {
  const resultat = {};
  const idCentral = PropertiesService.getScriptProperties().getProperty("ANNUAIRE_SHEET_ID");
  if (idCentral) {
    const feuille = SpreadsheetApp.openById(idCentral).getSheetByName("Annuaire");
    if (feuille) {
      const lignes = feuille.getDataRange().getValues();
      for (let i = 1; i < lignes.length; i++) {
        const nom = String(lignes[i][0] || "").trim();
        const id = String(lignes[i][1] || "").trim();
        const actif = String(lignes[i][2] || "OUI").trim().toUpperCase();
        if (nom && id && actif !== "NON") resultat[normaliserNomEcole(nom)] = { nom: nom, id: id };
      }
      return resultat;
    }
  }
  for (const nom in ANNUAIRE_ECOLES) {
    const id = String(ANNUAIRE_ECOLES[nom] || "").trim();
    if (id) resultat[normaliserNomEcole(nom)] = { nom: nom, id: id };
  }
  return resultat;
}

// ▶️ À exécuter une fois : crée le tableur central "A.B.C. – Annuaire" à partir de ANNUAIRE_ECOLES.
function creerAnnuaireCentral() {
  const ss = SpreadsheetApp.create("A.B.C. – Annuaire des établissements");
  const feuille = ss.getSheets()[0];
  feuille.setName("Annuaire");
  feuille.appendRow(["Etablissement", "ID_Tableur", "Actif (OUI/NON)"]);
  for (const nom in ANNUAIRE_ECOLES) feuille.appendRow([nom, ANNUAIRE_ECOLES[nom] || "", ANNUAIRE_ECOLES[nom] ? "OUI" : "NON"]);
  PropertiesService.getScriptProperties().setProperty("ANNUAIRE_SHEET_ID", ss.getId());
  Logger.log("Annuaire créé : " + ss.getUrl());
  return ss.getUrl();
}

// ▶️ À exécuter depuis l'éditeur pour accueillir un nouvel établissement :
//    creerEtablissement("COLLEGE EXEMPLE") crée son tableur (3 onglets + Parametres) et l'ajoute à l'annuaire.
function creerEtablissement(nom) {
  if (!nom) throw new Error("Indique le nom de l'établissement : creerEtablissement('NOM').");
  const ss = SpreadsheetApp.create("A.B.C. – " + nom);
  initialiserClasseur(ss);
  const idCentral = PropertiesService.getScriptProperties().getProperty("ANNUAIRE_SHEET_ID");
  if (idCentral) {
    SpreadsheetApp.openById(idCentral).getSheetByName("Annuaire").appendRow([nom, ss.getId(), "OUI"]);
  } else {
    Logger.log("Aucun annuaire central : ajoute \"" + nom + "\": \"" + ss.getId() + "\" dans ANNUAIRE_ECOLES.");
  }
  Logger.log("Tableur créé : " + ss.getUrl());
  return ss.getId();
}

// ==========================================================================
// ARCHITECTURE DES TABLEURS (ISOLATION PAR ÉTABLISSEMENT)
// ==========================================================================
function initialiserClasseur(ss) {
  let sheetGaspillage = ss.getSheetByName("Suivi_Gaspillage");
  if (!sheetGaspillage) {
    const def = ss.getSheets()[0];
    if (def && ["Historique_Menus", "Pesees_Sacs", "Parametres"].indexOf(def.getName()) === -1) {
      def.setName("Suivi_Gaspillage"); sheetGaspillage = def;
    } else { sheetGaspillage = ss.insertSheet("Suivi_Gaspillage"); }
  }
  let sheetMenus = ss.getSheetByName("Historique_Menus");
  if (!sheetMenus) sheetMenus = ss.insertSheet("Historique_Menus");
  let sheetSacs = ss.getSheetByName("Pesees_Sacs");
  if (!sheetSacs) sheetSacs = ss.insertSheet("Pesees_Sacs");
  let sheetParam = ss.getSheetByName("Parametres");
  if (!sheetParam) sheetParam = ss.insertSheet("Parametres");

  if (sheetGaspillage.getLastRow() === 0) {
    sheetGaspillage.appendRow(["Horodatage", "Type Entrée", "Note Visuelle", "Entrée (%)", "Plat (%)", "Dessert (%)", "Pain (%)", "Poids_Total_g", "Perte_Euro", "Avis Élève", "Detail_Ingredients_JSON"]);
  }
  if (sheetMenus.getLastRow() === 0) {
    sheetMenus.appendRow(["Horodatage", "Type Saisie", "Intitulé / Fichier", "Détail / Statut", "Effectif Attendu"]);
  }
  if (sheetSacs.getLastRow() === 0) {
    sheetSacs.appendRow(["Horodatage", "Sac_Alimentaire_kg", "Sac_Fruits_kg", "Sac_Pain_kg", "Sac_Emballages_kg", "Sac_Serviettes_kg"]);
  }
  if (sheetParam.getLastRow() === 0) sheetParam.appendRow(["Paramètre", "Valeur", "Description"]);
  const existants = {};
  sheetParam.getDataRange().getValues().forEach(function (l, i) { if (i > 0) existants[String(l[0])] = true; });
  PARAMETRES_DEFAUT.forEach(function (p) { if (!existants[p[0]]) sheetParam.appendRow(p); });

  return { gaspillage: sheetGaspillage, menus: sheetMenus, sacs: sheetSacs, parametres: sheetParam };
}

function getSheetsABC(nomEcole) {
  if (!nomEcole || nomEcole.toString().trim() === "" || nomEcole.toString().trim() === "Chargement...") {
    throw new Error("Erreur d'isolation : aucun établissement valide n'a été sélectionné.");
  }
  const entree = getAnnuaire()[normaliserNomEcole(nomEcole)];
  // Isolation stricte : jamais d'identifiant par défaut ni de bascule vers un autre établissement
  if (!entree) {
    throw new Error("Établissement non configuré : '" + nomEcole + "'. Ajoute-le avec creerEtablissement().");
  }
  const sheets = initialiserClasseur(SpreadsheetApp.openById(entree.id));
  if (!sheets.gaspillage.getRange("K1").getValue()) sheets.gaspillage.getRange("K1").setValue("Detail_Ingredients_JSON");
  return sheets;
}

// Paramètres propres à l'établissement (onglet "Parametres"), avec valeurs par défaut.
function getParametres(sheets) {
  const p = {};
  PARAMETRES_DEFAUT.forEach(function (d) { p[d[0]] = d[1]; });
  sheets.parametres.getDataRange().getValues().forEach(function (l, i) {
    if (i === 0) return;
    const v = parseFloat(String(l[1]).replace(",", "."));
    if (l[0] && !isNaN(v)) p[String(l[0])] = v;
  });
  return p;
}

function setParametre(sheets, cle, valeur) {
  const lignes = sheets.parametres.getDataRange().getValues();
  for (let i = 1; i < lignes.length; i++) {
    if (String(lignes[i][0]) === cle) { sheets.parametres.getRange(i + 1, 2).setValue(valeur); return; }
  }
  sheets.parametres.appendRow([cle, valeur, ""]);
}

function dateIso(d) {
  const o = new Date(d);
  return isNaN(o) ? "" : Utilities.formatDate(o, "Europe/Paris", "yyyy-MM-dd");
}

// Dernier menu enregistré pour une date (yyyy-MM-dd) ; sinon dernier menu connu.
function getMenuDuJour(sheets, isoJour) {
  const lignes = sheets.menus.getDataRange().getValues();
  let jour = "", dernier = "";
  for (let i = 1; i < lignes.length; i++) {
    if (lignes[i][1] !== "CONFIGURATION_MENU" || !lignes[i][2]) continue;
    dernier = String(lignes[i][2]);
    if (dateIso(lignes[i][0]) === isoJour) jour = String(lignes[i][2]);
  }
  return jour || dernier || "";
}

// ==========================================================================
// APPEL GEMINI (clé en en-tête, jamais dans l'URL) + REPRISE SUR 503/429
// ==========================================================================
function appelerGeminiParRequete(payloadData) {
  const maxTentatives = 3;
  let delaiMs = 2000;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + NOM_MODELE_GEMINI + ":generateContent";
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "x-goog-api-key": getCleGemini() },
    payload: JSON.stringify(payloadData),
    muteHttpExceptions: true
  };
  for (let i = 0; i < maxTentatives; i++) {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200) return response;
    if ((code === 503 || code === 429) && i < maxTentatives - 1) {
      Utilities.sleep(delaiMs); delaiMs *= 2;
    } else {
      throw new Error("Erreur HTTP " + code + " : " + response.getContentText());
    }
  }
  throw new Error("Service Gemini indisponible après plusieurs tentatives.");
}

// Référentiel (plan alimentaire, GRCN, EGalim, AGEC...) lu depuis GitHub, mis en cache 6 h.
function getReferentiel() {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get("referentiel_abc");
  if (enCache) return enCache;
  try {
    const r = UrlFetchApp.fetch(URL_REFERENTIEL, { muteHttpExceptions: true });
    if (r.getResponseCode() === 200 && r.getContentText().trim()) {
      const texte = r.getContentText();
      try { cache.put("referentiel_abc", texte.length < 90000 ? texte : texte.slice(0, 90000), 21600); } catch (e) {}
      return texte;
    }
  } catch (e) {}
  return "Référentiel GRCN standard.";
}

function reponseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================================================
// ROUTAGE DES ACTIONS ENTRANTES (POST)
// ==========================================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let responseOutput = { success: true };

    if (action === "askHub" || action === "questionHub" || action === "analyserQuestion") {
      return reponseJson({ answer: handleAskHub(data) });
    } else if (action === "logMenu") {
      responseOutput = handleLogMenu(data);
    } else if (action === "logBagWeights") {
      responseOutput = handleLogBagWeights(data);
    } else if (action === "analyzeDailyMenu") {
      return reponseJson({ answer: handleAnalyzeDailyMenu(data) });
    } else if (action === "analyzeMenuWithStats") {
      return reponseJson({ answer: handleAnalyzeMenuWithStats(data) });
    } else if (action === "logScanImage") {
      responseOutput = handleLogScanImage(data);
    } else if (action === "archiverMenu") {
      responseOutput = handleArchiverMenu(data);
    } else if (action === "analyserCauseRejet") {
      return reponseJson({ answer: handleAnalyserCauseRejet(data) });
    } else if (action === "analyserPlanAction") {
      return reponseJson(gererPlanActionEtApres(data));
    } else if (action === "saveEffectifs") {
      responseOutput = handleSaveEffectifs(data);
    }
    return reponseJson(responseOutput);
  } catch (error) {
    return reponseJson({ error: error.toString() });
  }
}

function gererPlanActionEtApres(data) {
  const etablissement = data.etablissement || "Établissement";
  const menuJour = data.menu_jour || "Menu du jour";
  const nbVotes = data.nb_votes || 0;
  const detailsTerrain = data.details || "Retours de la borne tactile";

  const promptIA = `
  Tu es un expert en éducation au développement durable (E3D), en alimentation scolaire (normes EGAlim, GES) et en ingénierie de la restauration collective.
  Analyse les données du service pour l'établissement "${etablissement}".
  Menu concerné : "${menuJour}".
  Retours et observations terrain de la borne (${nbVotes} votes/signaux) : "${detailsTerrain}".

  Génère une réponse structurée en DEUX BLOCS TOTALEMENT INDÉPENDANTS et une affiche. Ne mélange jamais les problématiques de cuisine et celles des élèves, car elles n'ont rien à voir.

  1. "cuisine" : Analyse technique et culinaire exclusive pour le chef et la production. Propose des remédiations sur le travail des produits bruts, la façon de penser et de dresser les assiettes, l'ajustement des recettes, des cuissons ou des textures.
  2. "eleves" : Analyse pédagogique et éco-citoyenne exclusive pour les éco-délégués et la vie classe. Parle de l'impact GES, de la valorisation du travail des agriculteurs locaux et donne des leviers pour les élèves.
  3. "affiche" : Conçois les éléments textuels d'une affiche percutante pour le self.

  Réponds UNIQUEMENT sous la forme d'un objet JSON valide, sans markdown (pas de \`\`\`json), avec cette structure exacte :
  {
    "cuisine": "Texte détaillé des leviers et remédiations techniques pour la cuisine...",
    "eleves": "Texte détaillé de la sensibilisation, GES, agriculture locale et rôle des éco-délégués...",
    "affiche": {
      "titre": "Titre court et accrocheur pour l'affiche au self",
      "slogan": "Slogan percutant axé sur le goût, le climat ou le producteur",
      "action": "Le geste précis attendu des élèves"
    }
  }
  `;

  const payloadData = {
    contents: [{ parts: [{ text: promptIA }] }]
  };

  try {
    const response = appelerGeminiParRequete(payloadData);
    const jsonResp = JSON.parse(response.getContentText());
    let rawText = jsonResp.candidates[0].content.parts[0].text.trim();
    
    // Nettoyage blindé des balises markdown si l'IA en remet
    let cleaned = rawText.replace(/^```json/gi, "").replace(/^```/g, "").replace(/```$/g, "").trim();
    
    let cleanJson;
    try {
      cleanJson = JSON.parse(cleaned);
    } catch (e1) {
      // Extraction de secours si du texte entoure le JSON
      let firstBrace = cleaned.indexOf('{');
      let lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } else {
        throw e1;
      }
    }
    
    return { success: true, plan: cleanJson };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function handleAskHub(data) {
  const publicCible = data.publicCible || data.niveau || data.cible || data.contexte || "Collège (DNB)";
  const question = data.question || data.message || data.texte || "";

  if (!question.trim()) {
    return `📍 Vous avez choisi le contexte : <b>${publicCible}</b><br><br>⚠️ Aucune question n'a été saisie.`;
  }

  const prompt = `[CONTEXTE OBLIGATOIRE] Le public cible est : "${publicCible}". Réponds strictement selon la doctrine officielle.\n\n${question}`;
  const payloadData = { contents: [{ parts: [{ text: prompt }] }] };

  const response = appelerGeminiParRequete(payloadData);
  const jsonResp = JSON.parse(response.getContentText());
  return `📍 Vous avez choisi le contexte : <b>${publicCible}</b><br><br>` + (jsonResp.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ Erreur de communication.");
}

// Effectif attendu par défaut, enregistré pour de vrai dans l'onglet "Parametres".
function handleSaveEffectifs(data) {
  const sheets = getSheetsABC(data.ecole || data.etablissement);
  const n = parseInt(String(data.effectifs_str || "").split("-").reduce(function (t, x) { return t + (parseInt(x) || 0); }, 0));
  if (!(n > 0)) throw new Error("Effectif invalide.");
  setParametre(sheets, "effectif_defaut", n);
  return { success: true, effectif: n };
}

// Un seul menu par date : on remplace la ligne du jour au lieu d'en ajouter une (plus de doublons).
function handleLogMenu(data) {
  const sheets = getSheetsABC(data.ecole || data.etablissement);
  let dateMenu = new Date();
  if (data.date_menu) {
    const parts = data.date_menu.split("-");
    if (parts.length === 3) dateMenu = new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const iso = dateIso(dateMenu);
  const effectif = parseInt(data.effectif) || getParametres(sheets).effectif_defaut;
  const ligne = [dateMenu, "CONFIGURATION_MENU", data.menu_complet || "Menu saisi", "", effectif];

  const lignes = sheets.menus.getDataRange().getValues();
  for (let i = lignes.length - 1; i >= 1; i--) {
    if (lignes[i][1] === "CONFIGURATION_MENU" && dateIso(lignes[i][0]) === iso) {
      sheets.menus.getRange(i + 1, 1, 1, 5).setValues([ligne]);
      return { success: true, remplace: true };
    }
  }
  sheets.menus.appendRow(ligne);
  return { success: true, remplace: false };
}

function handleArchiverMenu(data) {
  const ecole = data.ecole || data.etablissement;
  const sheets = getSheetsABC(ecole);
  sheets.menus.appendRow([new Date(), "ARCHIVAGE_DIRECT_SHEET", data.nomFichier || "Fichier_Menu", "Enregistré dans le tableur", parseInt(data.effectif) || 0]);
  return { success: true, nom: data.nomFichier || "Menu" };
}

function handleLogBagWeights(data) {
  const ecole = data.ecole || data.etablissement;
  const sheets = getSheetsABC(ecole);
  
  let datePesee = new Date();
  if (data.date_pesee) {
    let parts = data.date_pesee.split("-");
    if (parts.length === 3) {
      datePesee = new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }

  sheets.sacs.appendRow([
    datePesee, 
    parseFloat(data.sac_alimentaire) || 0, 
    parseFloat(data.sac_fruits) || 0, 
    parseFloat(data.sac_pain) || 0, 
    parseFloat(data.sac_emballages) || 0, 
    parseFloat(data.sac_serviettes) || 0
  ]);
  
  return { success: true };
}

// ==========================================================================
// SCAN DES PLATEAUX : l'IA est un CAPTEUR OPTIQUE (elle ne donne que des % de restes par aliment).
// Les grammes sont calculés ensuite par le code, avec la table de portions de l'établissement.
// ==========================================================================
const COMPOSANTS_VALIDES = ["entree", "plat", "accompagnement", "dessert", "pain"];

function nettoyerTexte(t) {
  return String(t == null ? "" : t).replace(/[\[\]:|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function portionReference(composant, aliment, p) {
  const a = String(aliment || "").toLowerCase();
  if (composant === "pain") return p.portion_pain_g;
  if (composant === "entree") return p.portion_entree_g;
  if (composant === "plat") return p.portion_plat_g;
  if (composant === "accompagnement") return p.portion_garniture_g;
  if (composant === "dessert") return /pomme|poire|banane|fruit|raisin|orange|clémentine|mandarine|kiwi|pêche|abricot|prune|fraise|melon|pastèque/.test(a) ? p.portion_fruit_g : p.portion_dessert_g;
  return p.portion_plat_g;
}

function handleLogScanImage(data) {
  const sheets = getSheetsABC(data.etablissement || data.ecole);
  if (!data.image_base64) throw new Error("Flux visuel manquant.");
  const avisEleve = data.avis_eleve || "Non renseigné";
  const params = getParametres(sheets);

  if (data.image_base64 === "empty") {
    sheets.gaspillage.appendRow([new Date(), "SCAN_IA_VISION", "Plateau Nettoyé (0% Restes)", 0, 0, 0, 0, 0, 0, avisEleve]);
    return { success: true };
  }
  const cleanBase64 = data.image_base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
  // Plus de "plateau simulé" : une image factice n'est jamais enregistrée comme une vraie mesure.
  if (cleanBase64 === "image_active_simulee") return { success: true, ignore: true, raison: "Caméra indisponible" };

  // Le menu du jour vient du tableur (complet), pas du texte tronqué envoyé par la borne.
  const menuJour = getMenuDuJour(sheets, dateIso(new Date())) || data.menu_jour || "Non spécifié";

  const promptVision = `Tu es un capteur optique pour la restauration scolaire (Projet A.B.C.). Tu ne calcules AUCUN poids : tu estimes seulement, visuellement, la part de chaque aliment qui RESTE sur le plateau.
La photo est prise de dessus, à la fin du repas, juste avant que l'élève vide son plateau.
MENU DU JOUR (options possibles ; sépare les aliments par "+", les rubriques par "|" : entrée | plat | accompagnement | dessert) : "${menuJour}".

RÈGLES
- Inventorie CHAQUE aliment visible. Utilise en priorité les noms du menu. Si tu vois un aliment qui n'est pas au menu, nomme-le prudemment et mets une confiance "faible". N'invente rien : si tu ne reconnais pas, dis-le.
- Pour chaque aliment, donne DEUX nombres cohérents : reste_pct (part qui reste de la portion servie, 0 à 100) et mange_pct (part mangée, 0 à 100). Leur somme doit faire 100.
- Un contenant vide, une peau, une rafle, un noyau ou une croûte non comestible = 0 % de reste.
- Un aliment absent du plateau (non pris par l'élève) ne doit PAS être listé.
- Si le plateau n'est pas visible (photo vide, plateau déjà débarrassé) : "plateau_visible": false. Si tu vois plusieurs plateaux, analyse celui du centre et indique "nb_plateaux".
- N'utilise ni deux-points, ni crochets, ni barre verticale dans les champs texte.

Réponds en JSON strict :
{
  "plateau_visible": true,
  "nb_plateaux": 1,
  "resume_comportement": "Phrase courte (ex. a trié les légumes mais mangé la viande).",
  "aliments": [
    {"composant": "entree|plat|accompagnement|dessert|pain", "aliment": "Nom court", "forme": "entier, morceaux, rondelles, râpé, haché, purée...", "preparation": "cuisson et sauce visibles", "etat_reste": "aucun|intact|entamé|trié|émietté", "reste_pct": 0, "mange_pct": 100, "confiance": "haute|moyenne|faible"}
  ]
}`;

  const payloadData = {
    contents: [{ parts: [{ text: promptVision }, { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0 }
  };
  const response = appelerGeminiParRequete(payloadData);
  const jsonResp = JSON.parse(response.getContentText());
  if (!jsonResp.candidates || !jsonResp.candidates[0].content) throw new Error("Réponse invalide de l'API Gemini pour le scan.");
  const result = JSON.parse(jsonResp.candidates[0].content.parts[0].text.replace(/```json/gi, "").replace(/```/g, "").trim());

  // Plateau absent : on n'enregistre rien (évite de fausser les statistiques).
  if (result.plateau_visible === false) return { success: true, ignore: true, raison: "Aucun plateau visible" };

  // Validation : on écarte les aliments incohérents (reste + mangé ≠ 100) ou de composant inconnu.
  const retenus = [], ecartes = [];
  (Array.isArray(result.aliments) ? result.aliments : []).forEach(function (a) {
    const reste = parseFloat(a.reste_pct), mange = parseFloat(a.mange_pct);
    const composant = String(a.composant || "").toLowerCase();
    const incoherent = isNaN(reste) || isNaN(mange) || Math.abs(reste + mange - 100) > 15 || reste < 0 || reste > 100;
    if (incoherent || COMPOSANTS_VALIDES.indexOf(composant) === -1 || !nettoyerTexte(a.aliment)) { ecartes.push(a); return; }
    const aliment = nettoyerTexte(a.aliment);
    const portion = portionReference(composant, aliment, params);
    retenus.push({
      composant: composant, aliment: aliment, forme: nettoyerTexte(a.forme) || "?", preparation: nettoyerTexte(a.preparation) || "?",
      etat_reste: nettoyerTexte(a.etat_reste), reste_pct: Math.round(reste), portion_ref_g: portion,
      reste_g_ref: Math.round(portion * reste / 100), confiance: nettoyerTexte(a.confiance) || "moyenne"
    });
  });

  function moyennePct(composants) {
    const l = retenus.filter(function (i) { return composants.indexOf(i.composant) !== -1; });
    return l.length ? Math.round(l.reduce(function (t, i) { return t + i.reste_pct; }, 0) / l.length) : 0;
  }
  const poidsG = retenus.reduce(function (t, i) { return t + i.reste_g_ref; }, 0);
  const perteEuro = (poidsG / 1000) * params.prix_kg_eur;

  let note = nettoyerTexte(result.resume_comportement) || "Analyse visuelle effectuée.";
  if (retenus.length) {
    note += " | DÉTAIL INGRÉDIENTS : " + retenus.map(function (i) {
      return "[" + i.aliment + " - " + i.forme + " - " + i.preparation + " : " + i.reste_pct + "% restes | " + i.composant + " | confiance " + i.confiance + "]";
    }).join(" ");
  }
  if (ecartes.length) note += " | " + ecartes.length + " aliment(s) écarté(s) (incohérents)";

  sheets.gaspillage.appendRow([
    new Date(), "SCAN_IA_VISION", note,
    moyennePct(["entree"]), moyennePct(["plat", "accompagnement"]), moyennePct(["dessert"]), moyennePct(["pain"]),
    poidsG, parseFloat(perteEuro.toFixed(2)), avisEleve, JSON.stringify({ retenus: retenus, ecartes: ecartes.length })
  ]);
  return { success: true, details: { aliments: retenus, ecartes: ecartes.length } };
}

function handleAnalyserCauseRejet(data) {
  const ecole = data.etablissement || data.ecole;
  const dateRejet = data.date || "Date non spécifiée";
  const menuJour = data.menu_jour || "Menu non renseigné";
  const detailsRestes = data.details_restes || {};
  
  const promptCausal = `
Tu es l'expert en ergonomie alimentaire et en analyse comportementale de la restauration collective du Projet A.B.C. (Assiette Bas Carbone). 
Un pic de gaspillage anormal ou un rejet massif a été détecté pour l'établissement "${ecole}" à la date du ${dateRejet}.

Voici les données factuelles de ce service :
- MENU DU JOUR : 
${menuJour}

- DÉTAIL DES RESTES OBSERVÉS (par composant) :
- Entrée : ${detailsRestes.entree || 0}% de gaspillage
- Plat / Féculent : ${detailsRestes.plat || 0}% de gaspillage
- Dessert : ${detailsRestes.dessert || 0}% de gaspillage
- Pain : ${detailsRestes.pain || 0}% de gaspillage

PROTOCOLE D'ANALYSE CAUSALE MULTI-PARAMÈTRES À APPLIQUER :
Analyse ce rejet en tenant impérativement compte des 4 axes suivants :
1. LA QUANTITÉ & L'ORDRE D'INGESTION : Si le dessert est rejeté massivement, est-ce une saturation stomacale due à des portions d'entrée ou de plat trop lourdes ? Si c'est le plat principal, l'entrée a-t-elle coupé l'appétit ou y a-t-il un déséquilibre de volume ?
2. LA CONCURRENCE ET LES ASSOCIATIONS D'ALIMENTS : Quel autre accompagnement ou plat était en concurrence directe ce jour-là ? (ex: frites vs riz, double féculent). Y avait-il une sauce ou un élément de liaison ("mouillage") pour éviter la sécheresse de l'aliment rejeté (ex: riz sans sauce) ?
3. L'ASPECT VISUEL ET L'APPÉTENCE : Est-ce que l'intitulé ou la nature du plat suggère un aspect visuel monotone, peu ragoutant ou difficile à manger en collectivité ?
4. LA PROJECTION ET LA CORRÉLATION HISTORIQUE : Formule une hypothèse claire sur la cause racine de ce rejet et propose une modification concrète pour les prochains cycles de menus.

Structure ta réponse de manière claire, percutante et professionnelle pour le chef cuisinier.
`;

  const payloadData = { contents: [{ parts: [{ text: promptCausal }] }] };
  
  try {
    const response = appelerGeminiParRequete(payloadData);
    const jsonResp = JSON.parse(response.getContentText());
    if (!jsonResp.candidates || !jsonResp.candidates[0].content) {
       return "⚠️ L'analyse a été bloquée par l'IA (filtres de sécurité de Google).";
    }
    return jsonResp.candidates[0].content.parts[0].text;
  } catch (e) {
    return "⚠️ Erreur technique lors de l'analyse causale : " + e.toString();
  }
}

function handleAnalyzeDailyMenu(data) {
  const prompt = `Vous agissez en qualité de conseiller technique et nutritionnel expert en restauration collective scolaire. Vous vous adressez avec rigueur et courtoisie au chef cuisinier d'un établissement scolaire qui vous soumet son menu du jour : "${data.menu}".

RÉFÉRENTIEL OFFICIEL À APPLIQUER (plan alimentaire départemental, GRCN, EGalim, AGEC, avis ANSES). Appuyez-vous UNIQUEMENT sur ce référentiel pour les fréquences, seuils et textes cités ; ne citez aucun texte qui n'y figure pas :
${getReferentiel()}

Procédez à une analyse technique et opérationnelle structurée :
1. CONFORMITÉ ET POINTS DE VIGILANCE : confrontez ce menu au référentiel (catégories concernées, fréquences à surveiller sur le cycle de 20 repas, alertes) en citant le texte correspondant. Précisez qu'un seul menu ne permet pas de juger une fréquence sur 20 repas.
2. HACCP : rappel sanitaire pertinent pour ce menu (aucune denrée entamée ou présentée en service ne quitte la cuisine ou le réfectoire).
3. BIODÉCHETS INÉVITABLES / ÉVITABLES : composants de ce menu générant des déchets inévitables (os, écorces, trognons, peaux) et repères pour les distinguer du gaspillage évitable.
4. PORTIONS ET PRÉVENTION DU GASPILLAGE : ajustement des portions, dressage et appétence pour limiter les retours d'assiettes.

Structurez votre réponse de manière claire, formelle et adaptée à un cadre professionnel.`;
  try {
    const response = appelerGeminiParRequete({ contents: [{ parts: [{ text: prompt }] }] });
    const jsonResp = JSON.parse(response.getContentText());
    if (!jsonResp.candidates || !jsonResp.candidates[0].content) return "⚠️ L'analyse a été bloquée par l'IA (filtres de sécurité de Google).";
    return jsonResp.candidates[0].content.parts[0].text;
  } catch (e) {
    return "⚠️ Erreur technique lors de l'analyse du menu : " + e.toString();
  }
}

function compterOptionsParColonne(contenuMenu) {
  if (!contenuMenu) return { nbJoursService: 20, entrees: 20, plats: 20, accompagnements: 20, desserts: 20 };
  const lignes = contenuMenu.split('\n');
  let nbJoursService = 0, totalEntrees = 0, totalPlats = 0, totalAccomp = 0, totalDesserts = 0;

  for (let i = 1; i < lignes.length; i++) {
    let ligne = lignes[i].trim();
    if (ligne === '') continue;
    let cols = ligne.split(';');
    if (cols.length < 5) { nbJoursService++; totalEntrees++; totalPlats++; totalAccomp++; totalDesserts++; continue; }
    let hasFood = false;
    for (let c = 2; c < cols.length; c++) { if (cols[c] && cols[c].trim() !== '') { hasFood = true; break; } }
    if (!hasFood) continue;
    nbJoursService++;
    if (cols[2] && cols[2].trim() !== '') totalEntrees++;
    if (cols[3] && cols[3].trim() !== '') totalEntrees++;
    if (cols[4] && cols[4].trim() !== '') totalEntrees++;
    if (cols[5] && cols[5].trim() !== '') totalPlats++;
    if (cols[6] && cols[6].trim() !== '') totalPlats++;
    if (cols[7] && cols[7].trim() !== '') totalPlats++;
    if (cols[8] && cols[8].trim() !== '') totalAccomp++;
    if (cols[9] && cols[9].trim() !== '') totalAccomp++;
    if (cols[10] && cols[10].trim() !== '') totalAccomp++;
    if (cols[11] && cols[11].trim() !== '') totalDesserts++;
    if (cols[12] && cols[12].trim() !== '') totalDesserts++;
    if (cols[13] && cols[13].trim() !== '') totalDesserts++;
  }
  const joursRef = nbJoursService > 0 ? nbJoursService : 20;
  return {
    nbJoursService: joursRef,
    entrees: totalEntrees > 0 ? totalEntrees : joursRef,
    plats: totalPlats > 0 ? totalPlats : joursRef,
    accompagnements: totalAccomp > 0 ? totalAccomp : joursRef,
    desserts: totalDesserts > 0 ? totalDesserts : joursRef
  };
}

function handleAnalyzeMenuWithStats(data) {
  const schoolName = data.etablissement || data.ecole || data.school || data.nomEcole;
  if (!schoolName) throw new Error("Erreur d'isolement : aucun établissement sélectionné.");

  const isFilePayload = data.payloadFile && data.payloadFile.type === "file";
  const menuContent = isFilePayload ? "" : (data.payloadFile ? data.payloadFile.content : (data.menu || data.contenu || data.fileContent || data.menu_complet));

  const sheets = getSheetsABC(schoolName);
  const params = getParametres(sheets);
  sheets.menus.appendRow([new Date(), "AUDIT_CYCLE_20_REPAS", "Analyse cycle pour " + schoolName, "Traité et enregistré", params.effectif_defaut]);

  // Comptage réel pour un texte/CSV. Pour un document (PDF/image) il n'existe PAS de comptage fiable
  // côté serveur : l'IA doit compter elle-même dans le document et le dire (plus de chiffres fictifs).
  let inventaire;
  if (isFilePayload) {
    inventaire = "INVENTAIRE : aucun comptage préalable n'est fourni. Compte toi-même, dans le document, le nombre d'options de chaque catégorie et indique explicitement que ce comptage a été effectué par l'IA sur le document.";
  } else {
    const s = compterOptionsParColonne(menuContent);
    inventaire = "INVENTAIRE MATRICIEL DES OPTIONS RELEVÉES (comptage automatique du fichier) :\n- Entrées : " + s.entrees + " options\n- Plats : " + s.plats + " options\n- Accompagnements : " + s.accompagnements + " options\n- Desserts / produits laitiers : " + s.desserts + " options\n- Jours de service : " + s.nbJoursService;
  }

  const socle = `
====================================================================
PROTOCOLE D'EXPERTISE CROISÉE & MÉTHODE HYBRIDE
====================================================================
ÉTABLISSEMENT AUDITÉ : ${schoolName}
${inventaire}

RÈGLE DE CALCUL ET DE FORMATAGE DE LA PARTIE 2 :
1. Comptage sur le volume réel des choix : dénombre les critères par rapport au volume total des options de la catégorie.
2. Conversion normalisée au format 20 repas : présente le résultat sous la forme "X / [Total options] (= [Équivalent sur 20 repas] / 20)".

1. LECTURE DES CHOIX MULTIPLES : analyse précisément chaque alternative proposée en concurrence directe.
2. MULTI-ÉTIQUETAGE : Céleri rémoulade (crudité + entrée grasse), Donuts/Cordon bleu (frit + P/L <=1 + plat préparé <70%).
3. VIANDES NON HACHÉES : minimum 4 repas de viande de boucherie brute (bœuf, veau, agneau, abats). Les steaks hachés et boulettes ne comptent pas.
4. ALERTE SANITAIRE (AVIS ANSES JANVIER 2025) : le soja en restauration scolaire est fortement déconseillé.
5. MISE EN FORME : structure ta réponse en 4 sections encadrées par des blocs HTML colorés :
  • Partie 1 : Les Points Forts -> Fond saumon clair
  • Partie 2 : Repères d'Équilibre, Analyse des Fréquences & Multi-Étiquetage -> Fond bleu ciel. Inclus un tableau HTML récapitulatif.
  • Partie 3 : Points de Vigilance Terrain -> Fond orange clair
  • Partie 4 : Avis de Pré-Validation & Pistes d'Accompagnement -> Fond vert clair. Signé par l'assistant virtuel d'analyse du plan alimentaire du projet A.B.C. Assiette Bas Carbone.
`;
  const parts = [{ text: "Tu es l'assistant virtuel expert du Projet A.B.C. (Assiette Bas Carbone), spécialisé en nutrition, restauration collective et conformité réglementaire (GRCN). Applique strictement notre protocole d'expertise hybride pour l'établissement " + schoolName + " :\n\n" + getReferentiel() + "\n\n" + socle }];
  if (isFilePayload) {
    parts.push({ inlineData: { mimeType: data.payloadFile.mimeType, data: data.payloadFile.base64.replace(/^data:.*;base64,/, "") } });
    parts[0].text += "\n\nVoici le document de menus soumis à ton audit croisé pour cet établissement :";
  } else {
    parts[0].text += "\n\nPROPOSITION DE CYCLE DE MENUS NORMALISÉ : \n" + menuContent;
  }
  const response = appelerGeminiParRequete({ contents: [{ parts: parts }] });
  return JSON.parse(response.getContentText()).candidates?.[0]?.content?.parts?.[0]?.text || "⚠ Erreur de communication.";
}

// ==========================================================================
// LECTURE (GET)
// ==========================================================================
function doGet(e) {
  if (e.parameter && e.parameter.action) {
    if (e.parameter.action === "getEtablissements") {
      return reponseJson(Object.keys(getAnnuaire()).map(function (k) { return getAnnuaire()[k].nom; }));
    }
    if (e.parameter.action === "getDashboard") {
      const school = e.parameter.ecole;
      const vide = { ecole: school, effectifCouverts: 0, dernierMenu: "Non configuré", historiqueMenus: {}, historiqueEffectifs: {}, parametres: {}, rawGaspillage: [], sacsHistory: { labels: [], datesRaw: [], alimentaire: [], fruits: [], pain: [], emballages: [], serviettes: [] } };
      try {
        const sheets = getSheetsABC(school);
        const parametres = getParametres(sheets);

        let dernierMenu = "Non configuré", dernierEffectif = 0;
        const historiqueMenusMap = {}, historiqueEffectifs = {};
        const menuRows = sheets.menus.getDataRange().getValues();
        for (let i = 1; i < menuRows.length; i++) {
          if (menuRows[i][1] === "CONFIGURATION_MENU" && menuRows[i][2]) {
            const ds = dateIso(menuRows[i][0]);
            dernierMenu = menuRows[i][2];
            dernierEffectif = parseInt(menuRows[i][4]) || dernierEffectif;
            if (ds) { historiqueMenusMap[ds] = menuRows[i][2]; if (parseInt(menuRows[i][4]) > 0) historiqueEffectifs[ds] = parseInt(menuRows[i][4]); }
          }
        }

        const rawGaspillage = [];
        const gRows = sheets.gaspillage.getDataRange().getValues();
        for (let i = 1; i < gRows.length; i++) {
          rawGaspillage.push({
            date: gRows[i][0], dateRaw: dateIso(gRows[i][0]), type: gRows[i][1], commentaire: gRows[i][2],
            entree: gRows[i][3], plat: gRows[i][4], dessert: gRows[i][5], pain: gRows[i][6],
            poids: gRows[i][7], perte: gRows[i][8], avis_eleve: gRows[i][9] || ""
          });
        }

        const h = { labels: [], datesRaw: [], alimentaire: [], fruits: [], pain: [], emballages: [], serviettes: [] };
        const sRows = sheets.sacs.getDataRange().getValues();
        for (let i = 1; i < sRows.length; i++) {
          const d = new Date(sRows[i][0]);
          h.labels.push(Utilities.formatDate(d, "Europe/Paris", "dd/MM"));
          h.datesRaw.push(Utilities.formatDate(d, "Europe/Paris", "yyyy-MM-dd"));
          h.alimentaire.push(parseFloat(sRows[i][1]) || 0);
          h.fruits.push(parseFloat(sRows[i][2]) || 0);
          h.pain.push(parseFloat(sRows[i][3]) || 0);
          h.emballages.push(parseFloat(sRows[i][4]) || 0);
          h.serviettes.push(parseFloat(sRows[i][5]) || 0);
        }
        return reponseJson({
          ecole: school, effectifCouverts: dernierEffectif || parametres.effectif_defaut, dernierMenu: dernierMenu,
          historiqueMenus: historiqueMenusMap, historiqueEffectifs: historiqueEffectifs, parametres: parametres,
          rawGaspillage: rawGaspillage, sacsHistory: h
        });
      } catch (err) {
        vide.error = err.toString();
        return reponseJson(vide);
      }
    }
  }
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('A.B.C. - Assiette Bas Carbone').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
