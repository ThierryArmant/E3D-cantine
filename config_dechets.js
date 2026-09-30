// Dictionnaire des coefficients de déchets inévitables (références ADEME / ...)
const COEFFICIENTS_INEVITABLES = {
    "poulet avec os": 0.30, // ~30% d'os et cartilages
    "filet de colin": 0.10, // ~10% de parures ou arêtes éventuelles
    "frites": 0.00,         // 100% consommable
    "tomate mozzarella": 0.10, // ~10% pédoncules / jus perdu
    "salade verte": 0.10,   // ~10% trognons et feuilles abîmées
    "salade endives noix roquefort": 0.15, // ~15% trognons d'endives
    "pomme": 0.15,          // ~15% trognon et pépins
    "fruit de saison": 0.20, // ~20% épluchures /noyaux variables
    "yaourt aux fruits mixés": 0.00, // 0% (emballage géré à part)
    "île flottante": 0.00   // 0%
};
