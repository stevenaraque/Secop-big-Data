import { useState } from "react";
import PageBackground from "./PageBackground.jsx";

// PantallaCarga — fallback de Suspense a página completa.
// Qué: spinner esmeralda + metal líquido de fondo. Por qué: la carga de
// chunks dejaba un "Cargando…" plano que rompía la identidad.
// Tema congelado: captura claro/oscuro AL ENTRAR y no cambia aunque el
// usuario alterne el toggle a mitad de carga (manda el primero).
export default function PantallaCarga({ texto = "Cargando observatorio…" }) {
  // OJO: se lee localStorage (misma fuente de useTheme), NO la clase de <html>.
  // El loader monta ANTES de que cualquier efecto ponga .dark, así que leer
  // la clase siempre daba "claro" aunque tu tema guardado fuera oscuro.
  const [tema] = useState(() => {
    try {
      const saved = localStorage.getItem("secop-theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {
      /* sin storage: cae a preferencia del SO */
    }
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const oscuro = tema === "dark";

  return (
    <div
      className="min-h-[100dvh] grid place-items-center relative isolate"
      style={{ backgroundColor: oscuro ? "#050505" : "#fcfcfc" }}
    >
      <PageBackground tema={tema} />
      <div className="relative flex flex-col items-center gap-4 p-6">
        <div
          className={`w-12 h-12 rounded-2xl grid place-items-center font-bold text-[15px] tracking-tighter ${oscuro ? "bg-white text-black" : "bg-zinc-900 text-white"}`}
        >
          SI
        </div>
        <span
          role="status"
          aria-label="Cargando"
          className={`size-8 rounded-full border-[3px] animate-spin ${oscuro ? "border-zinc-700" : "border-zinc-200"} border-t-emerald-500`}
        />
        <p className={`text-sm animate-pulse ${oscuro ? "text-zinc-300" : "text-zinc-600"}`}>{texto}</p>
      </div>
    </div>
  );
}
