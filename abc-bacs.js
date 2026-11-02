// Saisie des déchets : sous la pesée du jour, l'estimation de chaque poubelle d'après les plateaux scannés.
// Estimation = moyenne par plateau scanné × couverts du jour (plateaux sortis). Les scans antérieurs
// à la répartition par poubelle n'ont pas de « bacs » : le bouton « Réanalyser » les reprend depuis leurs photos.
const BACS_ABC = [
  ["biodechets", "alimentaire", "🍽️ Alimentaire (biodéchets)"],
  ["fruits", "fruits", "🍎 Fruits"],
  ["pain", "pain", "🥖 Pain"],
  ["emballages", "emballages", "📦 Emballages (avec leur contenu)"],
  ["serviettes", "serviettes", "🧻 Serviettes"]
];

function bacsFormatKg(g) { return (g / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg"; }

function majComparaisonBacs() {
  const zone = document.getElementById("abc-comparaison-bacs");
  if (!zone) return;
  const d = typeof globalRawData !== "undefined" ? globalRawData : null;
  const date = (document.getElementById("input-pesee-date") || {}).value || "";
  if (!d || !date) { zone.innerHTML = ""; return; }
  const scans = (d.rawGaspillage || []).filter(s => normalizeDate(s.dateRaw) === date);
  const vus = scans.filter(s => s.type === "SCAN_IA_VISION");
  const avecBacs = vus.filter(s => s.bacs);
  const attente = scans.filter(s => s.type === "SCAN_EN_ATTENTE").length;
  const couverts = (d.historiqueEffectifs || {})[date] || (d.parametres || {}).effectif_defaut || 0;
  const pesees = (d.peseesDetail || []).filter(p => p.date === date);
  const pese = {}; BACS_ABC.forEach(([, cle]) => { pese[cle] = pesees.reduce((t, p) => t + (Number(p[cle]) || 0), 0); });
  let html = `<div style="margin:6px 0 16px; padding:12px 14px; border:1px solid #cbd5e1; border-left:5px solid #1d4ed8; border-radius:10px; background:#f8fafc;">
    <h3 style="margin:0 0 4px; font-size:14px; color:#1e3a8a; font-weight:800;">📸 Pesée estimée d'après les plateaux scannés · ${date.split("-").reverse().join("/")}</h3>`;
  if (!scans.length) {
    zone.innerHTML = html + `<p style="margin:4px 0 0; font-size:12px; color:#64748b;">Aucun plateau scanné ce jour-là.</p></div>`;
    return;
  }
  if (avecBacs.length) {
    const somme = {}; BACS_ABC.forEach(([bac]) => { somme[bac] = avecBacs.reduce((t, s) => t + (Number(s.bacs[bac]) || 0), 0); });
    const facteur = couverts && avecBacs.length ? couverts / avecBacs.length : 1;
    const td = "padding:5px 8px; border-bottom:1px solid #e2e8f0;", num = td + " text-align:right; font-variant-numeric:tabular-nums;";
    const lignes = BACS_ABC.map(([bac, cle, nom]) => {
      const est = somme[bac] * facteur, p = pese[cle] * 1000;
      let ecart = '<span style="color:#94a3b8;">non pesé</span>';
      if (p > 0) {
        const e = Math.round(100 * (est - p) / p), coul = Math.abs(e) <= 15 ? "#047857" : Math.abs(e) <= 35 ? "#b45309" : "#b91c1c";
        ecart = `<strong style="color:${coul};">${e > 0 ? "+" : ""}${e} %</strong>`;
      }
      return `<tr><td style="${td}">${nom}</td><td style="${num}">${p > 0 ? bacsFormatKg(p) : "—"}</td><td style="${num} font-weight:800;">${bacsFormatKg(est)}</td><td style="${num}">${ecart}</td></tr>`;
    }).join("");
    html += `<p style="margin:0 0 8px; font-size:11.5px; color:#475569;">${avecBacs.length} plateau(x) analysé(s) par poubelle, ramené(s) à <strong>${couverts}</strong> couverts. Un écart fort sur un bac peut venir d'un sac changé en cours de service, d'un bac oublié ou des couverts du jour à corriger.</p>
      <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:12.5px;">
        <thead><tr style="background:#dbeafe; text-align:left;"><th style="${td}">Bac</th><th style="${td} text-align:right;">Pesé</th><th style="${td} text-align:right;">Estimé (scans)</th><th style="${td} text-align:right;">Écart</th></tr></thead>
        <tbody>${lignes}</tbody></table></div>`;
  }
  const anciens = vus.length - avecBacs.length;
  if (anciens > 0) html += `<p style="margin:8px 0 0; font-size:12px; color:#92400e;">${anciens} plateau(x) de ce jour ont été analysés avant la répartition par poubelle${avecBacs.length ? " et ne comptent pas dans l'estimation" : ""}.</p>`;
  if (attente) html += `<p style="margin:6px 0 0; font-size:12px; color:#1d4ed8;">⏳ ${attente} plateau(x) en cours d'analyse : actualisez dans quelques minutes.</p>`;
  if (anciens > 0 && !attente) html += `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px;">
      <button type="button" class="btn" id="btn-reanalyser-jour" style="width:auto; padding:7px 12px; font-size:12px; background:#1d4ed8;">🔁 Réanalyser les plateaux de ce jour à partir des photos</button>
      <span id="reanalyse-etat" style="font-size:11.5px; color:#475569;">Environ ${Math.ceil(anciens * 6 / 60)} min en arrière-plan. L'ancien résultat est conservé dans l'onglet Historique_Analyses.</span></div>`;
  zone.innerHTML = html + "</div>";
  const b = document.getElementById("btn-reanalyser-jour");
  if (b) b.addEventListener("click", () => reanalyserJourBacs(date, anciens));
}

async function reanalyserJourBacs(date, n) {
  const b = document.getElementById("btn-reanalyser-jour"), etat = document.getElementById("reanalyse-etat");
  if (!window.confirm(`Réanalyser les ${n} plateau(x) du ${date.split("-").reverse().join("/")} à partir de leurs photos ? Ils sortent des statistiques le temps de l'analyse (environ ${Math.ceil(n * 6 / 60)} min).`)) return;
  b.disabled = true; etat.textContent = "Envoi de la demande…";
  try {
    const ecole = document.getElementById("select-etablissement").value;
    const r = await fetch(ADRESSE_SHEET_OFFICIELLE, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "reanalyserJour", ecole: ecole, date: date }) });
    const res = await r.json();
    if (!res.success) throw new Error(res.error || "refusé par le script");
    etat.textContent = `✅ ${res.plateaux} plateau(x) remis en analyse. Actualisez dans quelques minutes.`;
    if (typeof loadLiveData === "function") setTimeout(loadLiveData, 4000);
  } catch (e) {
    b.disabled = false;
    etat.textContent = "Échec : " + String(e.message || e).replace(/^Error:\s*/, "") + (/inconnue|undefined/i.test(String(e.message)) ? " (le script Google doit être mis à jour)" : "");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const champ = document.getElementById("input-pesee-date");
  if (champ) champ.addEventListener("change", majComparaisonBacs);
});
