// Saisie des déchets : « L'Œil de l'IA » et « Défi du jour » tirés des plateaux scannés (aliment le plus jeté),
// et aliment le plus jeté dans l'historique par jour. Sans scan ce jour-là, on garde les poubelles pesées.
function defiPortionsABC() {
  const p = (typeof globalRawData !== "undefined" && globalRawData && globalRawData.parametres) || {};
  return { entree: p.portion_entree_g || 80, plat: p.portion_plat_g || 100, accompagnement: p.portion_garniture_g || 150,
    dessert: p.portion_dessert_g || 100, fruit: p.portion_fruit_g || 150, pain: p.portion_pain_g || 50, sauce: p.portion_sauce_g || 20 };
}
function defiEstFruit(n) {
  n = n.toLowerCase();
  if (/compote|yaourt|tarte|g[âa]teau|muffin|cr[èe]me|jus|sirop/.test(n)) return false;
  return /(^|[^a-zà-ÿ])(pomme|poire|banane|orange|cl[ée]mentine|mandarine|kiwi|p[êe]che|abricot|prune|raisin|melon|past[èe]que|fraise|nectarine|fruit)/.test(n);
}
// Aliments jetés d'une journée, d'après le détail de chaque plateau analysé.
function alimentsJeteJourABC(date) {
  const d = typeof globalRawData !== "undefined" ? globalRawData : null;
  if (!d || !date) return null;
  const scans = (d.rawGaspillage || []).filter(s => s.type === "SCAN_IA_VISION" && normalizeDate(s.dateRaw) === date);
  if (!scans.length) return null;
  const por = defiPortionsABC(), parAliment = {};
  scans.forEach(s => {
    const re = /\[([^\]]+?) - [^\]]*?: (\d+)% restes \| (\w+)/g; let m;
    while ((m = re.exec(String(s.commentaire || "")))) {
      let nom = m[1].trim(); const pct = +m[2]; let comp = m[3];
      if (/^aliment non identifi/i.test(nom) || /^sauce\b/i.test(nom) || !pct) continue;
      if (/^pain\b/i.test(nom)) { comp = "pain"; nom = "Pain"; }
      const portion = comp === "dessert" && defiEstFruit(nom) ? por.fruit : (por[comp] || por.plat);
      const cle = nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase();
      const a = parAliment[cle] || (parAliment[cle] = { nom: nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase(), g: 0, plateaux: 0, entiers: 0 });
      a.g += portion * pct / 100; a.plateaux++; if (pct >= 90) a.entiers++;
    }
  });
  const couverts = (d.historiqueEffectifs || {})[date] || scans.length;
  const facteur = Math.max(1, couverts / scans.length);
  // Même calcul que le tableau des ingrédients : quand la poubelle est pesée, son poids réel est réparti
  // entre les aliments selon leur part dans les restes vus sur les plateaux.
  const h = d.sacsHistory || {}, pese = { alim: 0, fruits: 0, pain: 0 };
  (h.datesRaw || []).forEach((x, i) => { if (normalizeDate(x) === date) { pese.alim += +h.alimentaire[i] || 0; pese.fruits += +h.fruits[i] || 0; pese.pain += +h.pain[i] || 0; } });
  const bac = a => /^pain$/i.test(a.nom) ? "pain" : (defiEstFruit(a.nom) ? "fruits" : "alim");
  const totaux = { alim: 0, fruits: 0, pain: 0 };
  Object.values(parAliment).forEach(a => { totaux[bac(a)] += a.g; });
  const liste = Object.values(parAliment).map(a => {
    const b = bac(a);
    return Object.assign(a, { kg: pese[b] > 0 && totaux[b] > 0 ? pese[b] * a.g / totaux[b] : a.g * facteur / 1000 });
  }).sort((x, y) => y.kg - x.kg);
  return liste.length ? { liste: liste, scans: scans.length, couverts: couverts, pese: pese.alim + pese.fruits + pese.pain > 0 } : null;
}
function defiKg(v) { return v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg"; }

function majDefiDuJourABC() {
  const diag = document.getElementById("bilan-ia-diag"), defi = document.getElementById("bilan-ia-defi");
  if (!diag || !defi) return;
  const date = (document.getElementById("input-pesee-date") || {}).value || "";
  const r = alimentsJeteJourABC(date);
  if (!r) {
    diag.textContent = "Aucun plateau scanné ce jour-là : le défi s'appuiera sur les plateaux dès qu'ils seront analysés.";
    defi.innerHTML = "🎯 <strong>Défi du jour :</strong> scanner les plateaux pour savoir quel aliment est le plus gaspillé.";
    return;
  }
  const [a, b, c] = r.liste;
  const entiers = r.liste.filter(x => x.entiers >= 3).sort((x, y) => y.entiers - x.entiers)[0];
  diag.innerHTML = `D'après <strong>${r.scans}</strong> plateau(x) analysé(s)${r.pese ? " et la pesée du jour" : ""} : <strong>${a.nom}</strong> est l'aliment le plus jeté (≈ ${defiKg(a.kg)}, laissé sur ${a.plateaux} plateaux)`
    + (b ? `, devant ${b.nom} (≈ ${defiKg(b.kg)})` : "") + (c ? ` et ${c.nom} (≈ ${defiKg(c.kg)})` : "") + "."
    + (entiers ? ` ${entiers.entiers} ${entiers.nom.toLowerCase()} ont été jetés sans être entamés.` : "");
  defi.innerHTML = `🎯 <strong>Défi du jour :</strong> moins de ${a.nom.toLowerCase()} laissé dans les assiettes au prochain service`
    + (entiers && entiers.nom !== a.nom ? ` — et pas un seul ${entiers.nom.toLowerCase()} jeté sans être entamé !` : " !");
}

document.addEventListener("DOMContentLoaded", () => {
  const champ = document.getElementById("input-pesee-date");
  if (champ) champ.addEventListener("change", majDefiDuJourABC);
});
