/** Étoiles de note (maquette : 5 SVG 13 px, remplies en encre jusqu'à la note arrondie). */
export function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-px" role="img" aria-label={`${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.6l2.8 6 6.6.6-5 4.5 1.5 6.5L12 16.9l-5.9 3.3 1.5-6.5-5-4.5 6.6-.6z" fill={i <= Math.round(rating) ? "#141210" : "#D6CFC0"} />
        </svg>
      ))}
    </span>
  );
}
