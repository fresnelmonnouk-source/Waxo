/** Rangée de 5 étoiles pleines (#141210) / vides (#D6CFC0) arrondies à l'entier, comme `starsOf` de la maquette. */
export function Stars({ value, size, gap = 1 }: { value: number; size: number; gap?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="flex" style={{ gap }} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2.6l2.8 6 6.6.6-5 4.5 1.5 6.5L12 16.9l-5.9 3.3 1.5-6.5-5-4.5 6.6-.6z"
            fill={i <= rounded ? "#141210" : "#D6CFC0"}
          />
        </svg>
      ))}
    </span>
  );
}
