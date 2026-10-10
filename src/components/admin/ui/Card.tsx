import type { ReactNode } from "react";

/** Carte blanche du back-office (maquette : background #fff, rayon 22, padding 20). */
export function Card({ children, className = "", as: Tag = "section", label }: { children: ReactNode; className?: string; as?: "section" | "div" | "aside"; label?: string }) {
  return (
    <Tag aria-label={label} className={`flex flex-col rounded-[22px] bg-white p-5 ${className}`}>
      {children}
    </Tag>
  );
}

/** Indicateur chiffré (maquette : rayon 20, padding 18/20). */
export function KpiCard({
  label,
  value,
  sub,
  subColor = "#4A443C",
  valueColor,
  size = 26,
}: {
  label: string;
  value: string;
  sub: string;
  subColor?: string;
  valueColor?: string;
  size?: 22 | 24 | 26;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] bg-white px-5 py-[18px]">
      <span className="text-[13px] text-[#4A443C]">{label}</span>
      <strong
        className="font-display font-semibold tracking-[-0.03em]"
        style={{ fontSize: size, color: valueColor }}
      >
        {value}
      </strong>
      <span className="text-[13px]" style={{ color: subColor }}>
        {sub}
      </span>
    </div>
  );
}
