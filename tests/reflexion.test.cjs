// Analyse d'un plateau : réflexion courte demandée, repli sans ce réglage si le modèle le refuse, jetons notés.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const c = vm.createContext({ Logger: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) } });
vm.runInContext(fs.readFileSync('apps_script/Code.gs', 'utf8'), c);
c.getParametres = () => ({ portion_entree_g: 80, portion_plat_g: 100, portion_garniture_g: 150, portion_dessert_g: 100, portion_fruit_g: 150, portion_pain_g: 50, portion_sauce_g: 20, prix_kg_eur: 4.5 });
c.getMenuDuJour = () => 'Salade | Poulet | Riz | Yaourt';
c.lireCatalogueABC = () => [];
c.referencePhotoJourABC = () => '';
c.dateIso = () => '2026-11-03';
const appels = [];
const reponse = { candidates: [{ content: { parts: [{ text: JSON.stringify({ plateau_visible: true, resume_comportement: 'ok', aliments: [{ aliment: 'Riz', composant: 'accompagnement', reste_pct: 20, confiance: 'haute' }], objets: [] }) }] } }], usageMetadata: { promptTokenCount: 4000, thoughtsTokenCount: 300, candidatesTokenCount: 200 } };
c.appelerGeminiParRequete = p => {
  appels.push(JSON.parse(JSON.stringify(p.generationConfig)));

  return { getContentText: () => JSON.stringify(reponse) };
};
const r = c.analyserPlateauABC({}, 'AAAA', new Date('2026-11-03T12:00:00Z'), 'x', '');
assert.equal(appels.length, 1);
assert.equal(appels[0].thinkingConfig, undefined, "réglage du modèle par défaut");
assert.equal(appels[0].mediaResolution, 'MEDIA_RESOLUTION_HIGH', 'photo lue en haute résolution');

assert.deepEqual(JSON.parse(r.ligne[10]).jetons, { entree: 4000, reflexion: 300, sortie: 200 });
console.log('OK : réflexion courte, repli si refusée, jetons notés.');
// Pain rangé par l'IA en « accompagnement » : remis en pain (50 g, bac pain).
const rep2 = { candidates: [{ content: { parts: [{ text: JSON.stringify({ plateau_visible: true, resume_comportement: 'ok', aliments: [{ aliment: 'Pain', composant: 'accompagnement', reste_pct: 100, mange_pct: 0, confiance: 'haute' }], objets: [] }) }] } }] };
c.appelerGeminiParRequete = () => ({ getContentText: () => JSON.stringify(rep2) });
const r2 = JSON.parse(c.analyserPlateauABC({}, 'AAAA', new Date('2026-11-03T12:00:00Z'), 'x', '').ligne[10]);
assert.equal(r2.retenus[0].composant, 'pain'); assert.equal(r2.retenus[0].portion_ref_g, 50); assert.equal(r2.bacs.pain, 50); assert.equal(r2.bacs.biodechets, 0);
console.log('OK : pain remis dans le bac pain.');
