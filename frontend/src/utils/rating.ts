// Note perso stockée sur 10, affichée sur 5 avec demi-étoiles : 9 -> "4,5"
export const formatRating = (value: number) => (value / 2).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
