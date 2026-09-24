// Formato de dinero a prueba de billones.
// Qué: ≥1 billón (1e12) se compacta ("$1,24 billones"), lo demás completo.
// Por qué: "$1.234.567.890.123" en text-4xl se sale de la tarjeta en móvil.
// El valor exacto va en `title` (tooltip nativo) para no perder precisión.

// eslint-disable-next-line no-magic-numbers
const BILLON = 1e12;

export function dineroCorto(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0";
  if (Math.abs(n) >= BILLON) {
    return `$${(n / BILLON).toLocaleString("es-CO", { maximumFractionDigits: 2 })} billones`;
  }
  return `$${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

export function dineroExacto(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0 COP";
  return `$${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })} COP`;
}
