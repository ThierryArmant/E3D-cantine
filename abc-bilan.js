// Bilan carbone du réseau : chiffres « Alimentation » du formulaire « Projet EPLE bas carbone ».
// Seulement le mesuré : un jour compte s'il a un menu enregistré ; aucune projection sur l'année.
// Facteurs (kg CO2e par repas, et par kg de déchets) recopiés de l'onglet « base emission carbone » du fichier du réseau.
const BILAN_FACTEURS = { moyen: 2.25, vege: 0.51, rouge: 7.26, poisson: 2, blanche: 1.58 };
const BILAN_FACTEUR_DECHETS = 0.0481;
const BILAN_LIBELLES = { moyen: "Repas moyens", vege: "Repas végétariens", rouge: "Repas viande rouge", poisson: "Repas poisson", blanche: "Repas viande blanche" };
const BILAN_ORDRE = ["moyen", "vege", "rouge", "poisson", "blanche"]; // ordre des questions du formulaire

function bilanNorm(t) { return String(t || "").toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, ""); }

// Catégorie d'un plat. Porc et plats mixtes (lasagnes, couscous...) : repas moyen. Inconnu : null.
function bilanCategorie(nom) {
  const n = bilanNorm(nom).replace(/\(.*?\)/g, " ").trim();
  if (!n || /^sans plat/.test(n)) return null;
  if (/vege|vegetal|vegetarien|soja|tofu|falafel|seitan/.test(n)) return "vege";
  if (/lasagne|couscous|paella|tajine|cassoulet|choucroute|hachis|parmentier|chili|porc|saucisse|jambon|lardon|knack|chipolata|carbonara|bolognaise|raviol|cannelloni|pizza|burger|kebab|moussaka/.test(n)) return "moyen";
  if (/poisson|colin|cabillaud|merlu|saumon|thon|lieu |hoki|sardine|maquereau|truite|dorade|limande|crevette|moule|calamar|fruits de mer|brandade|surimi|poissonnette/.test(n)) return "poisson";
  if (/poulet|dinde|volaille|pintade|canard|lapin|cordon bleu|nugget|aiguillette/.test(n)) return "blanche";
  if (/boeuf|steak|hache|bourguignon|agneau|veau|gardiane|taureau|merguez|boulette|daube|navarin|mouton|bavette|kefta/.test(n)) return "rouge";
  if (/omelette|oeuf|croustillant fromager|galette|pois chiche|lentille|haricots rouges|quiche|gratin de legumes/.test(n)) return "vege";
  return null;
}

// Plats d'un menu « entrées | plats | accompagnements | desserts » (options entre parenthèses ignorées).
function bilanPlats(menu) {
  const parts = String(menu || "").split("|");
  if (parts.length < 2) return [];
  return parts[1].replace(/\(.*?\)/g, "").split("+").map(x => x.replace(/🧑‍🍳|🧑‍‍🍳|🧑‍‍‍🍳/g, "").trim()).filter(x => x && !/^sans plat/i.test(x));
}

function bilanAnneeScolaire() {
  const d = new Date(), an = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return { debut: an + "-09-01", fin: d.toISOString().slice(0, 10) };
}

// Calcul pur (testable) : données du tableau de bord -> repas par catégorie, déchets, détail par jour.
function bilanCalculer(data, debut, fin) {
  const menus = data.historiqueMenus || {}, effectifs = data.historiqueEffectifs || {};
  const defaut = (data.parametres && data.parametres.effectif_defaut) || 0;
  const repas = { moyen: 0, vege: 0, rouge: 0, poisson: 0, blanche: 0 };
  const jours = [], stats = { jours: 0, choix: 0, choixSansScan: 0, nonReconnus: 0 };
  // Choix réellement pris par les élèves, d'après les plats lus sur les plateaux de chaque jour.
  const prisParJour = {};
  (data.rawGaspillage || []).forEach(s => {
    if (s.type !== "SCAN_IA_VISION") return;
    const d = String(s.dateRaw || "").slice(0, 10);
    (String(s.commentaire || "").match(/\[([^\]]+)\]/g) || []).forEach(m => {
      const c = m.slice(1, -1), sep = c.lastIndexOf(":");
      if (sep < 0 || !/\|\s*plat\s*\|/.test(c.slice(sep))) return;
      const cat = bilanCategorie(c.slice(0, sep).split(" - ")[0]);
      if (cat) { const j = prisParJour[d] = prisParJour[d] || {}; j[cat] = (j[cat] || 0) + 1; }
    });
  });
  Object.keys(menus).sort().forEach(d => {
    if (d < debut || d > fin) return;
    const couverts = parseInt(effectifs[d], 10) || defaut;
    if (!couverts) return;
    const plats = bilanPlats(menus[d]);
    const cats = [];
    let inconnu = false;
    plats.forEach(p => { const c = bilanCategorie(p); if (!c) inconnu = true; else if (cats.indexOf(c) < 0) cats.push(c); });
    let parts = {};
    if (!cats.length) { parts.moyen = 1; stats.nonReconnus++; }
    else if (cats.length === 1) parts[cats[0]] = 1;
    else {
      stats.choix++;
      const pris = prisParJour[d] || {}, total = cats.reduce((t, c) => t + (pris[c] || 0), 0);
      if (!total) stats.choixSansScan++;
      cats.forEach(c => { parts[c] = total ? (pris[c] || 0) / total : 1 / cats.length; });
    }
    Object.keys(parts).forEach(c => { repas[c] += couverts * parts[c]; });
    stats.jours++;
    jours.push({ date: d, plats: plats.join(" + ") || "—", couverts: couverts, parts: parts, inconnu: inconnu && !cats.length });
  });
  BILAN_ORDRE.forEach(c => { repas[c] = Math.round(repas[c]); });
  let dechetsKg = 0;
  const sh = data.sacsHistory || {};
  (sh.datesRaw || []).forEach((d, i) => {
    if (d < debut || d > fin) return;
    dechetsKg += (parseFloat(sh.alimentaire[i]) || 0) + (parseFloat(sh.fruits[i]) || 0) + (parseFloat(sh.pain[i]) || 0);
  });
  dechetsKg = Math.round(dechetsKg * 10) / 10;
  const co2 = BILAN_ORDRE.reduce((t, c) => t + repas[c] * BILAN_FACTEURS[c], 0) + dechetsKg * BILAN_FACTEUR_DECHETS;
  return { repas: repas, dechetsKg: dechetsKg, co2Kg: Math.round(co2), jours: jours, stats: stats };
}

function bilanFormat(n, dec) { return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }

function ouvrirBilanCarbone() {
  let m = document.getElementById("modal-bilan-carbone");
  if (!m) {
    m = document.createElement("div");
    m.id = "modal-bilan-carbone";
    m.style.cssText = "display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:9998; align-items:center; justify-content:center;";
    m.innerHTML = `<div style="background:white; width:94%; max-width:640px; max-height:90vh; overflow-y:auto; border-radius:12px; padding:18px 20px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.25); border-top:5px solid #2d6a4f;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <h3 style="margin:0; font-size:15px; color:#1b4332; font-weight:900;">🌍 Bilan carbone du réseau · Alimentation</h3>
          <button type="button" onclick="document.getElementById('modal-bilan-carbone').style.display='none'" style="background:#ef4444; color:white; border:none; border-radius:4px; width:26px; height:26px; font-weight:bold; cursor:pointer;">✕</button>
        </div>
        <p style="font-size:11.5px; color:#64748b; margin:0 0 10px;">Chiffres à reporter dans le formulaire « Projet EPLE bas carbone » pour <strong id="bilan-ecole"></strong>. Seulement le mesuré : chaque jour avec un menu enregistré, multiplié par ses couverts.</p>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; font-size:12px; margin-bottom:10px;">
          <label>Du <input type="date" id="bilan-debut" style="padding:3px 5px; border:1px solid #cbd5e1; border-radius:4px;"></label>
          <label>au <input type="date" id="bilan-fin" style="padding:3px 5px; border:1px solid #cbd5e1; border-radius:4px;"></label>
        </div>
        <div id="bilan-resultat"></div>
      </div>`;
    document.body.appendChild(m);
    ["bilan-debut", "bilan-fin"].forEach(id => document.getElementById(id).addEventListener("change", afficherBilanCarbone));
    const p = bilanAnneeScolaire();
    document.getElementById("bilan-debut").value = p.debut;
    document.getElementById("bilan-fin").value = p.fin;
  }
  document.getElementById("bilan-ecole").textContent = document.getElementById("select-etablissement").value;
  m.style.display = "flex";
  afficherBilanCarbone();
}

function afficherBilanCarbone() {
  const zone = document.getElementById("bilan-resultat");
  if (typeof globalRawData === "undefined" || !globalRawData) { zone.innerHTML = "<p style='font-size:12px; color:#b45309;'>Chargez d'abord le tableau de bord de l'établissement.</p>"; return; }
  const debut = document.getElementById("bilan-debut").value, fin = document.getElementById("bilan-fin").value;
  const r = bilanCalculer(globalRawData, debut, fin);
  if (!r.stats.jours) { zone.innerHTML = "<p style='font-size:12px; color:#64748b;'>Aucun menu enregistré sur cette période.</p>"; return; }
  const td = "padding:5px 8px; border-bottom:1px solid #e2e8f0;", num = td + " text-align:right; font-variant-numeric:tabular-nums;";
  let lignes = BILAN_ORDRE.map(c => `<tr><td style="${td}">${BILAN_LIBELLES[c]}</td><td style="${num} font-weight:800;">${bilanFormat(r.repas[c])}</td><td style="${num} color:#64748b;">× ${bilanFormat(BILAN_FACTEURS[c], 2)}</td><td style="${num}">${bilanFormat(r.repas[c] * BILAN_FACTEURS[c])} kg</td></tr>`).join("");
  lignes += `<tr><td style="${td}">Déchets alimentaires (kg)</td><td style="${num} font-weight:800;">${bilanFormat(r.dechetsKg, 1)}</td><td style="${num} color:#64748b;">× ${bilanFormat(BILAN_FACTEUR_DECHETS, 4)}</td><td style="${num}">${bilanFormat(r.dechetsKg * BILAN_FACTEUR_DECHETS, 1)} kg</td></tr>`;
  const s = r.stats, notes = [];
  if (s.choix) notes.push(`${s.choix} jour(s) à plusieurs plats : réparti(s) selon les plats relevés sur les plateaux${s.choixSansScan ? ` (${s.choixSansScan} sans plateau scanné : partage égal)` : ""}.`);
  if (s.nonReconnus) notes.push(`${s.nonReconnus} jour(s) dont le plat n'est pas reconnu : comptés en repas moyens (voir le détail).`);
  notes.push("Porc et plats mixtes (lasagnes, couscous, paella…) : repas moyens. Déchets alimentaires : pesées des bacs alimentaire, fruits et pain.");
  const detail = r.jours.map(j => `<tr><td style="${td}">${j.date}</td><td style="${td}">${j.plats.replace(/</g, "&lt;")}${j.inconnu ? " <span style='color:#b45309;'>(non reconnu)</span>" : ""}</td><td style="${num}">${j.couverts}</td><td style="${td}">${Object.keys(j.parts).map(c => BILAN_LIBELLES[c].replace("Repas ", "") + (j.parts[c] < 1 ? " " + Math.round(j.parts[c] * 100) + " %" : "")).join(", ")}</td></tr>`).join("");
  zone.innerHTML = `<table style="width:100%; border-collapse:collapse; font-size:12.5px;">
      <thead><tr style="background:#dcfce7; text-align:left;"><th style="${td}">Question du formulaire</th><th style="${td} text-align:right;">À saisir</th><th style="${td} text-align:right;">kg CO₂e / unité</th><th style="${td} text-align:right;">kg CO₂e</th></tr></thead>
      <tbody>${lignes}<tr><td style="${td} font-weight:800;" colspan="3">Total alimentation</td><td style="${num} font-weight:900; color:#1b4332;">${bilanFormat(r.co2Kg)} kg CO₂e</td></tr></tbody></table>
    <p style="font-size:11.5px; color:#475569; margin:8px 0 0;">${s.jours} jour(s) de menu comptés du ${debut} au ${fin}.</p>
    <ul style="font-size:11px; color:#64748b; margin:4px 0 0 18px; padding:0;">${notes.map(n => `<li>${n}</li>`).join("")}</ul>
    <div style="display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap;">
      <button type="button" class="btn" id="bilan-copier" style="width:auto; padding:6px 12px; font-size:12px; background:#047857;">📋 Copier les chiffres</button>
      <span id="bilan-copie-etat" style="font-size:11.5px; color:#047857;"></span>
    </div>
    <details style="margin-top:10px;"><summary style="font-size:12px; cursor:pointer; color:#1b4332; font-weight:700;">Détail jour par jour</summary>
      <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-top:6px;"><thead><tr style="background:#f1f5f9; text-align:left;"><th style="${td}">Date</th><th style="${td}">Plat(s)</th><th style="${td} text-align:right;">Couverts</th><th style="${td}">Catégorie</th></tr></thead><tbody>${detail}</tbody></table></div>
    </details>`;
  document.getElementById("bilan-copier").onclick = () => {
    const texte = BILAN_ORDRE.map(c => BILAN_LIBELLES[c] + "\t" + r.repas[c]).concat(["Déchets alimentaires (kg)\t" + String(r.dechetsKg).replace(".", ",")]).join("\n");
    const ok = () => { document.getElementById("bilan-copie-etat").textContent = "✅ Copié"; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(ok, () => { document.getElementById("bilan-copie-etat").textContent = "Copie refusée par le navigateur : sélectionnez le tableau."; });
  };
}

if (typeof module !== "undefined") module.exports = { bilanCategorie, bilanPlats, bilanCalculer };
