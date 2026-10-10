# E3D-cantine# 🥗 A.B.C. (Alimentation, Bilan, Carbone) - Collège Jean Giono

> **Dispositif innovant de lutte contre le gaspillage alimentaire et de pilotage de la cantine scolaire — Labellisé E3D Niveau 3.**

<p align="center">
  <img src="image_1_borneABC.jpg" alt="Borne de scan A.B.C. sur la ligne de tri du self" style="max-width:100%; border-radius: 8px;">
</p>

---

## 🎯 Présentation du Projet
L'application **A.B.C.** est un outil de suivi et de valorisation éco-citoyenne déployé au self du **Collège Jean Giono (Orange)**. Elle s'inscrit pleinement dans la démarche d'établissement en **Démarche de Développement Durable (E3D Niveau 3)**. 

L'objectif est double :
* **Sur le plan du terrain :** Mesurer et sensibiliser au gaspillage alimentaire grâce à une borne de scan interactive fabriquée par les élèves.
* **Sur le plan institutionnel :** Suivre les indicateurs de consommation et garantir la conformité des menus avec le plan alimentaire départemental (directives de Valérie Briançon, EGalim, CNRC).

---

## 🛠️ Innovation Pédagogique & Matériel (Conception Élèves)
Le dispositif de capture est le fruit d'une réalisation pratique et concrète menée avec les élèves :
* **Boîtier imprimé en 3D :** Fixé sur le haut des séparateurs orange caractéristiques de la ligne de tri du self.
* **Vision connectée :** Une caméra logée dans le boîtier pointe directement vers le rail où circulent les plateaux.
* **Ergonomie terrain :** Un **gros bouton d'arcade vert** permet à l'élève d'appuyer pour déclencher instantanément le scan (`"Appuyer pour scanner"`), garantissant une fiabilité absolue avant de vider son assiette dans les poubelles de tri dédiées.

---

## 📊 Architecture Technique
* **Front-end :** Interface web moderne avec effets de transparence (*Glassmorphism*), hébergée sur **GitHub Pages**.
* **Back-end & Stockage :** Centralisation de l'historique des menus et des logs d'analyse IA dans un **Google Sheet**.
* **Flux de données :** Saisie des déchets, calcul du bilan et édition automatisée des rapports institutionnels.

---

## 🚀 Fonctionnalités Clés
* **Espace Cuisinier / RAG :** Vérification des quotas stricts, des limitations de lipides, des produits frits et de la vigilance sur le soja.
* **Borne de Scan :** Suivi visuel et vocal en temps réel du taux d'adhésion réel et du pourcentage de déchets par plateau.
* **Bilan Institutionnel :** Synthèse automatisée du gaspillage global et des économies potentielles.

---
*Développé pour le Collège Jean Giono (Vaucluse)*

---

## ⚙️ Déploiement du script serveur (`apps_script/Code.gs`)
1. Coller `Code.gs` dans le projet Apps Script lié à l'application web.
2. **Clé Gemini** : exécuter une fois `configurerCle()` après avoir collé la clé dans la variable `MA_CLE`, puis effacer la clé du code. Elle est stockée dans les propriétés du script, jamais dans le dépôt.
3. **Annuaire des établissements** : exécuter `creerAnnuaireCentral()` (crée le tableur « Annuaire » : Etablissement | ID | Actif). Pour ajouter un établissement : `creerEtablissement("Nom")` crée son tableur avec les 4 onglets et ses paramètres.
4. **Publier une nouvelle version** du déploiement (même URL).
5. L'onglet `Parametres` de chaque tableur règle les portions de référence (g), l'effectif par défaut et le prix au kg utilisés par le calcul.

## 🧮 Méthode de calcul (résumé)
L'IA ne donne que des pourcentages de restes par aliment. Les poids viennent des balances sous les poubelles, répartis entre aliments selon ces restes et des portions de référence ; la bibliothèque d'inévitables sépare évitable et inévitable ; les facteurs carbone viennent d'Agribalyse 3.2 (ADEME/INRAE, août 2025), chacun relié à sa ligne source dans le code. Le détail, avec les valeurs réellement utilisées, est affiché dans le bouton « Transparence & Audit des calculs ».

---

## 🌱 Philosophie du projet et conditions de réutilisation

**A.B.C. – Assiette Bas Carbone** est un projet pédagogique développé pour aider les établissements scolaires à mesurer, comprendre et réduire le gaspillage alimentaire.

Ce projet est né d'un besoin concret rencontré en restauration scolaire et de la volonté de proposer une solution accessible aux établissements ne disposant pas des moyens financiers nécessaires à l'acquisition d'équipements commerciaux spécialisés.

**A.B.C. a vocation à rester gratuit pour les établissements scolaires.**

Son développement s'inscrit dans une démarche éducative, environnementale et non lucrative. L'objectif est de favoriser le partage des connaissances, l'amélioration des pratiques et la sensibilisation des élèves au gaspillage alimentaire.

Le code et les éléments originaux du projet sont susceptibles d'être protégés par le droit d'auteur. Leur publication sur GitHub ne constitue pas une autorisation générale d'exploitation commerciale.

Les conditions précises de réutilisation, de modification et de redistribution du code restent à définir dans une licence adaptée, après vérification de la titularité des droits.
