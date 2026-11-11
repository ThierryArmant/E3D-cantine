# Journal de coordination A.B.C.

## 4 novembre 2026 — Analyse des plateaux et calcul du repas

### Demande de Thierry et décisions validées

L’objectif est un pourcentage cohérent du repas de référence complet. Les grammages réglés par la cuisine dans la roue crantée définissent les portions. Le menu confirmé et les photos avant service servent à reconnaître les aliments et leur présentation entière. L’analyse du plateau en fin de repas estime les quantités comestibles restantes. Le logiciel réalise le calcul en grammes.

Le pain est toujours inclus dans le repas de référence, même sans photo du pain avant service.

Exemple validé avec les réglages affichés chez Giono
- Entrée 80 g
- Plat protidique 100 g
- Garniture 150 g
- Dessert ou laitage 100 g
- Pain 50 g
- Total de référence 480 g

Un dessert entier de 100 g restant correspond à environ 21 % de ce repas de référence. Le calcul doit pondérer les aliments par leur grammage. La moyenne des pourcentages des seuls aliments identifiés sur le plateau donne des résultats trompeurs.

Formule attendue

`restes alimentaires (%) = 100 × somme des grammes comestibles restants / grammes du repas de référence`

La présence de plusieurs desserts possibles au menu ne signifie pas que tous ont été servis. La règle dessert + fruit ou dessert au choix reste à préciser. Ne pas additionner arbitrairement toutes les options. Conserver le libellé « repas de référence » pour distinguer cette base conventionnelle des quantités réellement prises, inconnues si aucune mesure avant repas ne les établit.

### Sauce et préparation — point essentiel du projet

L’état de préparation est déterminant pour comparer l’acceptation d’un même aliment. Conserver les distinctions nature, en sauce, au beurre, ail, persil, râpé, cuit, etc., lorsqu’elles sont confirmées par la cuisine ou identifiables sur les photos.

La sauce, le beurre et les aromates sont des attributs de l’aliment préparé. Ils ne créent pas une portion supplémentaire de déchets ni une portion supplémentaire dans le repas de référence.

Quand l’aliment a été mangé et qu’il reste seulement de la sauce étalée dans l’assiette, classer ce résidu comme négligeable selon la convention demandée. Ne pas inventer une ligne « Sauce tomate — 60 % de restes ».

Ne pas déduire l’espèce d’un aliment consommé de la seule couleur de sauce. Une préparation non identifiable doit rester incertaine. Conserver la préparation confirmée dans les données de service pour permettre l’analyse de l’acceptation même lorsque le plateau ne contient plus l’aliment. Un aliment absent peut aussi ne pas avoir été pris. Distinguer les observations individuelles du contexte de service.

### Emballages et règle « tout consommé »

Les emballages vides sont des déchets non alimentaires, comptés séparément. Un film transparent, une caissette vide ou un pot vide ne prouvent pas la présence de l’aliment.

Un aliment réellement présent dans un emballage compte pour son contenu comestible restant. Son emballage est compté séparément. Un pot réellement scellé et plein peut représenter 100 % de ce produit, mais seulement sa part pondérée dans le repas complet.

Thierry a validé comme exemple de référence le plateau n° 5 du 2 novembre 2026, montré dans ses captures. Grande assiette avec sauce étalée, film plastique apparemment vide et quelques résidus infimes. Résultat attendu selon la convention A.B.C. « 100 % consommé — 0 % de restes alimentaires significatifs ». Négliger traces de sauce, miettes et résidus infimes. L’ancienne analyse indiquait sauce tomate 60 %, muffin entier 100 %, puis 80 % de restes affichés. Cette sortie est erronée.

Ne pas généraliser ce zéro aux plateaux portant simplement le choix élève « Tout fini ». Ce choix reste une déclaration distincte de l’analyse de la photo.

Les autres captures montrent notamment pain et muffin entamé, puis muffin sous film et pot de compote. Vérifier visuellement contenu, volume et ouverture avant attribution. Leur pourcentage éventuel doit être rapporté au repas complet, sans forcer zéro à partir du bouton de l’élève.

### Galerie et périmètre

La galerie GitHub Pages utilise les photos déjà sauvegardées dans Drive et les motifs associés aux scans. Chaque établissement doit consulter ses propres photos, classées dans son dossier, puis Plateaux, puis date de saisie. Pour Giono, COLLEGE J. GIONO / Plateaux / AAAA-MM-JJ.

Conserver rang de passage par jour, référence d’origine, identifiant du scan et motif de l’élève. Filtres par date, motif et état d’analyse. Ne pas ajouter de filtre interétablissements dans la galerie. Thierry demande de conserver les droits Drive existants et ne souhaite pas ajouter de nouveau système de connexion pour ces photos de plateaux.

La galerie existait déjà dans le dépôt avant mes modifications. Son auteur n’a pas été vérifié. Elle lit globalRawData.rawGaspillage. Le rattachement exact au collège actif et le rafraîchissement lors d’un changement de collège restent à vérifier en conditions réelles.

### Modifications publiées par GPT

- Commit 6ed8339d1bebe969bce027b0d726ea68605f0b99
  - Initialisation des filtres même si le script charge après DOMContentLoaded.
  - Événement change pour les sélecteurs et input pour la recherche.
  - Lecture de secours des pourcentages depuis parseScanItems(commentaire) lorsque detail n’est pas transmis.
  - Message explicite quand aucun résultat ne correspond.
  - Version de ressource actualisée.
  - Vérification de syntaxe et tests simulés de la combinaison avis/restes et du chargement avant/après DOMContentLoaded.

- Commit be5072915ee5bb02f16eb2079060adf3c94c82f2
  - Libellés précisant que la moyenne porte sur les aliments identifiés et ne mesure pas le repas complet.
  - Ce changement de libellés précède la décision de calcul sur repas de référence de 480 g.
  - Syntaxe vérifiée. Aucun test réel sur les photos de Thierry.

Ces commits modifient index.html et abc-analyse-photos.js. Le calcul global demandé n’a PAS encore été implémenté. Les changements de libellés sont provisoires et devront être remplacés par le calcul validé.

### État du serveur et points à corriger

Le serveur du dépôt est apps_script/Code.gs. Le fichier Code.gs à la racine n’existe pas. Le code serveur du dépôt transmet déjà detail et id_scan dans rawGaspillage. La copie Apps Script collée par Thierry plus tôt ne transmettait pas ces deux champs. La galerie montrait « ID scan non transmis ». Vérifier quelle version est effectivement déployée.

Dans la copie fournie, portionReference attribue une portion séparée de sauce et le prompt autorise une sauce distincte visible. Ces règles doivent être alignées sur la convention précisée par Thierry. Le prompt contient déjà des règles emballage/contenu, mais les erreurs constatées montrent qu’elles ne suffisent pas.

À réaliser
1. Vérifier le serveur réellement déployé et préserver les modifications concurrentes.
2. Renforcer les consignes visuelles sur film vide, caissette vide, traces de sauce et résidus négligeables.
3. Ajouter un contrôle déterministe des catégories résiduelles pour empêcher une sauce seule ou un objet vide d’acquérir une portion alimentaire. Garder la description de préparation et le décompte des emballages.
4. Calculer les grammes restants par aliment et le pourcentage du repas de référence incluant systématiquement le pain.
5. Conserver avec chaque nouvelle analyse la version de méthode et les portions utilisées. Ne pas recalculer silencieusement l’historique avec les réglages actuels.
6. Aligner galerie, filtres et statistiques sur la même définition. Un simple changement de libellé ne corrige pas les poids déjà enregistrés.
7. Tester les captures de référence, puis un petit échantillon contrasté, avec emballages vides, produit plein, plat mangé en sauce et restes solides.
8. Pour l’historique, utiliser une réanalyse contrôlée avec archivage des anciennes analyses. Ne pas lancer de réanalyse massive sans bilan préalable du coût et des résultats.

### Contraintes impératives

Préserver les protections récemment ajoutées après la perte de scans, la sauvegarde Drive, la file de reprise, les identifiants anti-doublons et la gestion des erreurs réseau ou de crédit.

Thierry demande de conserver Flash Lite. Ne pas changer de modèle ni ses paramètres par défaut dans cette intervention. Vérifier le modèle réellement utilisé dans les propriétés et le déploiement, car des noms de modèles différents figurent dans les versions du code.

Aucune modification du serveur Apps Script, aucune réanalyse et aucun appel IA de test n’ont été effectués par GPT durant cette séquence. Des copies locales de travail ont été créées pour inspection. Aucun changement de calcul serveur n’a été publié.

### Prochaine livraison attendue

Une correction complète du calcul et de l’analyse, testée sur les exemples, accompagnée de l’état exact du déploiement Apps Script. Le plateau n° 5 doit ressortir à 0 % de restes significatifs selon la convention validée. Les cas avec aliments réellement présents doivent conserver une estimation proportionnée au repas complet.

## 4 novembre 2026 (matin) — Livraison Claude : repas de référence

Commit de cette entrée. Serveur `apps_script/Code.gs` et galerie `abc-analyse-photos.js`.

- **Pain** : réglé dans la roue crantée en tranches par élève (2 par défaut) × poids d'une tranche (25 g par défaut) ; `portion_pain_g` en découle. Consigne IA : une tranche entière laissée sur 2 = 50 %.
- **Calcul** : `restes_pct_repas = 100 × restes_g / repas_ref_g`, repas de référence = entrée + plat + garniture + dessert + pain (roue crantée). Enregistrés dans le détail de chaque nouvelle analyse avec `methode: "repas-reference-1"`, `modele`, `portions_ref`, `repas_ref_g`, `restes_g`. Aucun recalcul de l'historique côté serveur.
- **Contrôle déterministe** : un aliment nommé sauce / mayonnaise / vinaigrette / ketchup / moutarde / huile / jus / assaisonnement n'est jamais une portion (liste `residus`). Restes ≤ 5 % = 0 (traces, miettes).
- **Consignes IA** : sauce et aromates = attributs de la préparation ; sauce étalée seule = aliment mangé ; garniture de présentation dans le même ramequin (lit de salade sous un œuf) = partie du plat ; fond de caissette / film froissé ≠ muffin (dôme, pépites ou mie exigés) ; forme et préparation = telles que servies.
- **Galerie** : affiche le % du repas de référence ; pour une analyse ancienne, le recalcul avec les réglages actuels est signalé comme tel. Filtre « Restes du repas ».
- **Test** `tests/repas-reference.test.cjs` : plateau n° 5 (sauce + traces) → 0 % ; n° 108 (une tranche + muffin 3/4) → 21 % ; riz entier → 31 %.
- **Inchangé** : modèle (propriété `MODELE_GEMINI`, Flash-Lite), sauvegarde Drive, file de reprise, anti-doublons, gestion réseau/crédit.
- **Desserts (validé par Thierry)** : deux portions de dessert seulement quand l'élève a pris un LAITAGE (yaourt, fromage…) ET un autre dessert (fruit, gâteau, compote…). 2 yaourts = 1 ; 2 fruits = 1 ; fruit + gâteau = 1 ; yaourt + fruit = 2 ; yaourt + gâteau = 2. Au moins 1 dessert ; portion du « autre » = la plus grande (fruit 150 g, dessert 100 g).
- **Reste ouvert** : un film vide pris pour un muffin ne peut être corrigé que par la vision (consigne renforcée, à vérifier sur les plateaux témoins avant toute réanalyse massive).
- **Petit gâteau d'accompagnement (validé par Thierry)** : un muffin, une madeleine, un biscuit ou un gâteau individuel servi AVEC une compote ou un fruit fait partie de ce dessert (pas de portion en plus dans le repas de référence). Sa consommation reste analysée à part (fiche aliment, Défi du jour) car un gâteau donné et non mangé doit interpeller. Ses restes comptent pour son poids réel : réglage « Petit gâteau servi avec compote ou fruit (g) », 40 g par défaut (`portion_gateau_accompagnement_g`), champ `accompagnement: true` dans le détail.
- **Estimation des quantités (04/11)** : pas d'assiette témoin (trop de combinaisons pour le chef). L'IA reçoit les portions de la roue crantée, compte les pièces (nombre servi indiqué au menu avec « ×N », ex. « Boulettes de viande ×5 ») et applique la règle « forme intacte = 90 à 100 % ». Cas témoin : plateau n° 479 du 02/11 (5 boulettes et riz presque entier, annoncé 20 % / 40 % par l'ancienne analyse ; attendu ≈ 100 % / 85-90 %, environ 55 % du repas).

---

## 6 novembre 2026 (soir) — Livraison Claude : pesées, fruits mélangés, cohérence des indicateurs

Réponse à la mission « Fiabilisation des pesées et des indicateurs » (retour de Mme Briançon). Giono reste la référence.

### 1. Ce qui existait déjà
- `handleCorrigerPeseeABC` (remplacement d'une ligne, contrôle de révision) existait, mais son écran était caché dans **✏️ Corrections** : depuis « Saisie des déchets », une correction ajoutait une nouvelle ligne.
- Anti double envoi : bouton grisé pendant l'envoi et refus serveur d'une pesée identique le même jour (déjà en place).
- Option `fruits_dans_biodechets` (colonne G de Pesees_Sacs) : en place depuis l'après-midi ; Giono l'utilise (06/11 : 49,95 kg « OUI »).

### 2. Diagnostic des trois problèmes
**Pesées qui s'additionnent.** Constaté à Gérard Philippe : le 02/11 compte 5 lignes (10,35/0,8/1,02 ; une ligne à zéro ; 10,35/4,41/1,02 ; 8,53/4,41/1,02 ; 10,35/4,4/1,02), le 03/11 trois lignes (dont une à zéro). Ce sont des tentatives de correction enregistrées comme sacs supplémentaires. Aucune ligne n'a été modifiée : les bonnes valeurs doivent être confirmées par l'établissement, qui peut maintenant les corriger ou les supprimer lui-même (voir 3).

**Fruits.** En mode mélangé, le champ fruits est mis à 0 et grisé ; le poids des fruits est dans les biodéchets ; rien n'est ajouté. Les comparatifs scan/balance rangent les fruits vus sur les plateaux dans la ligne biodéchets ces jours-là.

**Pourcentages différents pour une même pesée.** Trois calculs différents coexistaient :
| Écran | Avant | Après |
|---|---|---|
| Carte « Moyenne / convive » | évitable (pain compris) ÷ convives de chaque jour | inchangé (référence) |
| « Bilan élèves » (niveau 1 à 4) | (évitable + fruits + pain) ÷ effectif d'aujourd'hui : le pain était compté deux fois, les fruits (inévitables) ajoutés, mauvais effectif | même valeur que la carte « Moyenne / convive » |
| Bilan affiché au moment d'enregistrer | biodéchets × (1 − taux du menu actif, 0,30 par défaut) + fruits + pain ÷ effectif mémorisé (450 par défaut) | supprimé : le bilan est recalculé après l'enregistrement par la méthode du tableau de bord |
| Équivalent € du bilan | 2,30 €/kg en dur | prix_kg_eur de l'établissement (comme la carte « Pertes ») |
Restent volontairement distincts (définitions différentes, affichées comme telles) : « Restes du repas » d'un plateau (galerie, % du repas de référence) et « Précision scan / balance » (estimation photo comparée à la pesée, jamais présentée comme une pesée).

**Scans et analyses (Giono, 06/11).** 600 scans enregistrés, 600 photos sauvegardées sur Drive, 599 analyses terminées, 0 en attente, 1 impossible (aucun plateau visible). Les compteurs du site : « réellement scannés » = analysés + en attente + écartés ; « analysés » = terminés seulement. Un scan encore dans la file de la tablette n'est pas encore sur le serveur : il apparaît dans la puce de la borne (« en attente »). Aucune réanalyse n'est lancée pour afficher la galerie ou recalculer un indicateur.

### 3. Modifications (ciblées)
- `abc-pesees.js` (nouveau) : dans « Saisie des déchets », tableau des pesées déjà enregistrées pour la date choisie (lignes + total), boutons **✏️ Modifier cette pesée** (le formulaire se remplit, le bouton devient « Enregistrer la modification (remplace la pesée) », envoi `correctBagWeights` avec révision) et **🗑️ Supprimer** (confirmation). S'il existe déjà une pesée ce jour-là, le bouton devient « Ajouter un sac supplémentaire » et demande confirmation. Mode fruits par défaut = celui de la dernière pesée de l'établissement.
- Code.gs : `deleteBagWeights` → `handleSupprimerPeseeABC` (révision vérifiée ; la ligne est recopiée dans **Pesees_Supprimees** avant d'être retirée) ; `handleCorrigerPeseeABC` met aussi à jour la colonne G quand elle est transmise ; une pesée entièrement à zéro est refusée.
- index.html : libellé « Biodéchets, fruits compris » en mode mélangé ; bilan élèves aligné sur « Moyenne / convive ».

### 4. Tests (tests/pesees-correction.test.cjs + navigateur)
| Test | Résultat |
|---|---|
| Saisie initiale 12 kg | 12 kg ✓ |
| Correction 12 → 8 kg | 8 kg, aucune nouvelle ligne ✓ |
| Révision périmée | refusée ✓ |
| Ajout volontaire 3 kg | 11 kg ✓ ; renvoi identique : pas de doublon ✓ |
| Suppression du sac de 3 kg | 8 kg, copie dans Pesees_Supprimees ✓ |
| Fruits inclus | drapeau OUI, 0 kg fruits ajouté ✓ |
| Fruits pesés à part | 10 + 1,5 = 11,5 kg, sans double comptage ✓ |
| Correction d'une pesée ancienne | autres jours inchangés, drapeau conservé ✓ |
| Navigateur : liste, Modifier, Supprimer, Ajouter avec confirmation | requêtes correctes, aucune erreur JS ✓ |
| Pesée vide | refusée ✓ |
Tous les autres tests du dépôt passent.

### 5. Déploiement
- GitHub Pages : publié (commit de ce soir).
- Apps Script : **à coller et redéployer (Nouvelle version)**. Sans cela, « Modifier » fonctionne (fonction existante) mais **« Supprimer » renverra un message demandant le dernier Code.gs**. La version publiée côté Google n'est pas visible depuis le dépôt : Thierry doit confirmer le déploiement.

### 6. À faire par l'établissement
Gérard Philippe : dans Saisie des déchets, dates 02/11 et 03/11, garder la bonne pesée et supprimer les autres (elles restent archivées). Les valeurs justes sont à confirmer par Mme Briançon.

---

## 11 novembre 2026 — Écarts des 09 et 10/11 à Giono, contenu des pots

Pesées (fruits avec les biodéchets) : 09/11 biodéchets 17 kg, pain 1,25, emballages 4,17 ; 10/11 biodéchets 12,31, pain 2,95, emballages 7,75.
Estimation photo (627 et 628 plateaux) : 09/11 biodéchets + fruits 37,7 kg ; 10/11 23,6 kg. Pain et emballages cohérents.

Causes trouvées dans les analyses du 09/11 :
- « Pommes noisettes » rangées en **fruits** côté serveur (`estFruitFraisABC` reconnaissait « pomme ») : 16,6 kg. Corrigé (pommes noisettes, dauphines, frites, croquettes… exclues).
- **Kiwi** coupé en deux et mangé à la cuillère : demi-peaux vides lues comme « 50 % » (7,2 kg le 09, 6,9 kg le 10). Règle ajoutée au prompt : peaux vidées = 0 %.
- **Beurre** (plaquette) compté comme une entrée de 80 g : 2,1 kg. Beurre, cornichons, citron rangés avec les sauces (résidus), serveur et écran.
- Pommes noisettes et pennes : estimation en vrac, portions de référence probablement trop fortes → saisir les portions réelles du jour (Précision scan / balance) ou le nombre de pièces (×N) au menu.

Pots jetés pleins (yaourt, liégeois) : décision de Thierry, le contenu est du gaspillage alimentaire, le pot vide va aux emballages. Écran : le contenu des aliments « dans leur emballage » est désormais compté dans le gaspillage évitable (estimation photo ramenée aux convives, `contenuEmballagesKg`), sans être réparti sur les poubelles pesées ; la comparaison des poubelles reste physique (« Emballages, avec leur contenu »). Test ajouté.
