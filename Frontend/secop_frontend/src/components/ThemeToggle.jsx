import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme.js";

// Botón tema claro/oscuro. Va en headers + auth. Estado compartido vía evento + localStorage.
// Micro-interacción: iconos rotan/escalan al cambiar (estilo React Bits).
export default function ThemeToggle() {
  const { toggle, dark } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={dark ? "Tema claro" : "Tema oscuro"}
      className="h-9 w-9 grid place-items-center rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors overflow-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
    >
      <span className="relative block size-5" aria-hidden="true">
        <Sun
          size={20}
          className={`absolute inset-0 transition-all duration-300 ${
            dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          }`}
        />
        <Moon
          size={20}
          className={`absolute inset-0 transition-all duration-300 ${
            dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}
