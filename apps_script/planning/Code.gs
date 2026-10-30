/**
 * Brigade cantine A.B.C. — serveur du planning d'inscription
 * (la page élève est planning/index.html, hébergée sur GitHub Pages)
 *
 * Installation (une seule fois) :
 * 1. Crée un Google Sheet vide, par exemple « Planning brigade cantine ».
 * 2. Dans ce Sheet : Extensions > Apps Script. Remplace tout le contenu par ce fichier.
 * 3. Déployer > Nouveau déploiement > Type : Application Web
 *      Exécuter en tant que : Moi
 *      Qui a accès : Tout le monde
 *    Autorise l'accès quand Google le demande.
 * 4. Copie l'adresse du déploiement (…/exec) et colle-la dans planning/index.html,
 *    ligne « const ADRESSE_PLANNING = "" ».
 *
 * Les onglets « Inscriptions » et « Réglages » se créent tout seuls au premier appel.
 * Pour changer jours, créneaux, postes ou nombre de places : onglet « Réglages ».
 * Pour retirer un élève : supprime sa ligne dans l'onglet « Inscriptions ».
 * Après une modification de ce script : Déployer > Gérer les déploiements >
 * modifier > Nouvelle version (l'adresse reste la même).
 */

const ONGLET_INSCRIPTIONS = 'Inscriptions';
const ONGLET_REGLAGES = 'Réglages';

const REGLAGES_PAR_DEFAUT = [
  ['Paramètre', 'Valeur', 'Aide'],
  ['Titre', 'Brigade cantine A.B.C.', 'Titre affiché en haut de la page'],
  ['Jours', 'Lundi, Mardi, Jeudi, Vendredi', 'Séparés par des virgules'],
  ['Créneaux', '11h30-12h00, 12h00-12h30, 12h30-13h00, 13h00-13h30', 'Séparés par des virgules'],
  ['Postes', 'Scan plateau:2; Pain et fruits:2; Biodéchets et emballages:2', 'Nom:nombre de places, séparés par des points-virgules'],
  ['Inscriptions ouvertes', 'Oui', 'Oui ou Non'],
];

const ENTETES_INSCRIPTIONS = ['ID', 'Horodatage', 'Jour', 'Créneau', 'Poste', 'Prénom', 'Initiale', 'Classe', 'Empreinte code'];

/* ---------- Points d'entrée ---------- */

function doGet(e) {
  return repondre_(() => {
    const action = (e && e.parameter && e.parameter.action) || 'getData';
    if (action !== 'getData') throw new Error('Action inconnue.');
    return getData();
  });
}

function doPost(e) {
  return repondre_(() => {
    const corps = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (corps.action === 'inscrire') return inscrire(corps);
    if (corps.action === 'retirer') return retirer(corps.id, corps);
    throw new Error('Action inconnue.');
  });
}

function repondre_(fn) {
  let sortie;
  try { sortie = fn(); } catch (err) { sortie = { erreur: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(sortie)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- API appelée par la page ---------- */

function getData() {
  preparerOnglets_();
  return { config: lireReglages_(), inscriptions: lireInscriptions_() };
}

function inscrire(demande) {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const config = lireReglages_();
    if (!config.ouvert) throw new Error('Les inscriptions sont fermées pour le moment.');

    const id = verifierIdentite_(demande);
    if (config.jours.indexOf(demande.jour) < 0) throw new Error('Jour inconnu.');
    if (config.creneaux.indexOf(demande.creneau) < 0) throw new Error('Créneau inconnu.');
    const poste = config.postes.filter(p => p.nom === demande.poste)[0];
    if (!poste) throw new Error('Poste inconnu.');

    const liste = lireInscriptions_(true);
    const memeCase = liste.filter(i => i.jour === demande.jour && i.creneau === demande.creneau);
    if (memeCase.some(i => cle_(i) === id.cle)) {
      throw new Error('Tu es déjà inscrit(e) sur ce créneau, ' + demande.jour.toLowerCase() + ' ' + demande.creneau + '.');
    }
    const occupes = memeCase.filter(i => i.poste === poste.nom).length;
    if (occupes >= poste.places) throw new Error('Ce poste vient d\'être complété. Choisis une autre place.');

    // Le même code doit être utilisé par la même personne
    const dejaInscrit = liste.filter(i => cle_(i) === id.cle)[0];
    if (dejaInscrit && dejaInscrit.empreinte !== id.empreinte) {
      throw new Error('Ce prénom et cette classe sont déjà utilisés avec un autre code. Reprends ton code habituel.');
    }

    feuille_(ONGLET_INSCRIPTIONS).appendRow([
      Utilities.getUuid().slice(0, 8),
      new Date(),
      demande.jour,
      demande.creneau,
      poste.nom,
      id.prenom,
      id.initiale,
      id.classe,
      id.empreinte,
    ]);
    SpreadsheetApp.flush();
    return getData();
  } finally {
    verrou.releaseLock();
  }
}

function retirer(idInscription, identite) {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const id = verifierIdentite_(identite);
    const f = feuille_(ONGLET_INSCRIPTIONS);
    const valeurs = f.getDataRange().getValues();
    for (let r = 1; r < valeurs.length; r++) {
      if (String(valeurs[r][0]) === String(idInscription)) {
        const ligne = { prenom: valeurs[r][5], initiale: valeurs[r][6], classe: valeurs[r][7] };
        if (cle_(ligne) !== id.cle || valeurs[r][8] !== id.empreinte) {
          throw new Error('Code incorrect : seule la personne inscrite peut se retirer.');
        }
        f.deleteRow(r + 1);
        SpreadsheetApp.flush();
        return getData();
      }
    }
    throw new Error('Cette inscription n\'existe plus.');
  } finally {
    verrou.releaseLock();
  }
}

/* ---------- Outils internes ---------- */

function feuille_(nom) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
}

function preparerOnglets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(ONGLET_REGLAGES)) {
    const r = ss.insertSheet(ONGLET_REGLAGES);
    r.getRange(1, 1, REGLAGES_PAR_DEFAUT.length, 3).setValues(REGLAGES_PAR_DEFAUT);
    r.getRange(1, 1, 1, 3).setFontWeight('bold');
    r.setColumnWidth(1, 170); r.setColumnWidth(2, 460); r.setColumnWidth(3, 330);
  }
  if (!ss.getSheetByName(ONGLET_INSCRIPTIONS)) {
    const f = ss.insertSheet(ONGLET_INSCRIPTIONS, 0);
    f.getRange(1, 1, 1, ENTETES_INSCRIPTIONS.length).setValues([ENTETES_INSCRIPTIONS]).setFontWeight('bold');
    f.setFrozenRows(1);
    f.hideColumns(9);
  }
}

function lireReglages_() {
  const valeurs = feuille_(ONGLET_REGLAGES).getDataRange().getValues();
  const brut = {};
  valeurs.slice(1).forEach(l => { brut[String(l[0]).trim()] = String(l[1]).trim(); });
  const liste = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  const postes = String(brut['Postes'] || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const morceaux = x.split(':');
    return { nom: morceaux[0].trim(), places: Math.max(1, parseInt(morceaux[1], 10) || 1) };
  });
  return {
    titre: brut['Titre'] || 'Brigade cantine A.B.C.',
    jours: liste(brut['Jours']),
    creneaux: liste(brut['Créneaux']),
    postes: postes,
    ouvert: !/^non$/i.test(brut['Inscriptions ouvertes'] || 'Oui'),
  };
}

function lireInscriptions_(avecEmpreinte) {
  const valeurs = feuille_(ONGLET_INSCRIPTIONS).getDataRange().getValues();
  return valeurs.slice(1).filter(l => l[0] !== '').map(l => {
    const o = {
      id: String(l[0]), jour: String(l[2]), creneau: String(l[3]), poste: String(l[4]),
      prenom: String(l[5]), initiale: String(l[6]), classe: String(l[7]),
    };
    if (avecEmpreinte) o.empreinte = String(l[8]);
    return o;
  });
}

function verifierIdentite_(d) {
  const prenom = String(d.prenom || '').trim().replace(/\s+/g, ' ');
  const initiale = String(d.initiale || '').trim().charAt(0).toUpperCase();
  const classe = String(d.classe || '').trim().toUpperCase().replace(/\s+/g, '');
  const code = String(d.code || '').trim();
  if (prenom.length < 2 || prenom.length > 30) throw new Error('Indique ton prénom.');
  if (!/^[A-ZÀ-Ý]$/i.test(initiale)) throw new Error('Indique l\'initiale de ton nom.');
  if (classe.length < 2 || classe.length > 12) throw new Error('Indique ta classe (ex. 4E2).');
  if (!/^\d{4}$/.test(code)) throw new Error('Ton code doit faire 4 chiffres.');
  const prenomPropre = prenom.charAt(0).toUpperCase() + prenom.slice(1);
  const empreinte = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, code + '|' + SpreadsheetApp.getActiveSpreadsheet().getId())
  );
  const id = { prenom: prenomPropre, initiale: initiale, classe: classe, empreinte: empreinte };
  id.cle = cle_(id);
  return id;
}

function cle_(o) {
  const n = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
  return n(o.prenom) + '|' + n(o.initiale) + '|' + n(o.classe);
}
