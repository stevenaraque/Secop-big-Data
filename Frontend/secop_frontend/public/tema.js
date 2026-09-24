/* tema.js — fija claro/oscuro ANTES del primer pintado (anti-flash).
 * Qué: lee localStorage (misma fuente de useTheme) y pone .dark en <html>.
 * Por qué: React lo ponía en un efecto, DESPUÉS del primer paint → flash blanco.
 * Va con <script src="/tema.js"> bloqueante en <head> (300 bytes, sin defer).
 * Respeta CSP script-src 'self': archivo externo, cero inline. */
try {
  var t = localStorage.getItem("secop-theme");
  if (t !== "dark" && t !== "light") {
    t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.classList.toggle("dark", t === "dark");
  document.documentElement.style.colorScheme = t;
} catch {
  /* sin storage: queda el claro por defecto */
}
