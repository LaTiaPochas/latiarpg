import Link from "next/link";

export const garrisonBackLinkClassName =
  "inline-flex items-center gap-1 rounded-md border border-[#7a5c31]/80 bg-[#7d6138] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] sm:text-[10px]";

type GarrisonBackLinkProps = {
  className?: string;
};

export function GarrisonBackLink({ className }: GarrisonBackLinkProps) {
  const mergedClassName = className
    ? `${garrisonBackLinkClassName} ${className}`
    : garrisonBackLinkClassName;

  return (
    <Link href="/garrison" className={mergedClassName}>
      <span className="text-sm leading-none" aria-hidden>
        ←
      </span>
      volver al campamento
    </Link>
  );
}
