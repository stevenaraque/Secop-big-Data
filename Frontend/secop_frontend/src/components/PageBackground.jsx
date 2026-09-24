import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import Background from "./Background.jsx";
import MoltenMetal from "./MoltenMetal.jsx";

// PageBackground — fondo compartido de toda la app (observatorio, login, /app).
// Qué: aurora CSS de base + metal WebGL encima, paleta según tema.
// Por qué: un solo lugar para el fondo; las 3 páginas se ven coordinadas.
// El metal entra tras idle, solo con WebGL2 y sin reduced-motion.
// `tema` ("dark"/"light"): congela la paleta con la que se entró — el loader
// la usa para no parpadear si el usuario cambia el tema a mitad de carga.
// Úsalo dentro de un contenedor `relative isolate` para que el -z-10 quede dentro.
export default function PageBackground({ opacityDark = 0.85, opacityLight = 0.8, tema = null }) {
  const reduce = useReducedMotion();

  // Tema para el metal: carbón en oscuro, escarcha en claro.
  // Con `tema` fijo se usa ese y no se escucha más (el primero manda).
  const [esOscuro, setEsOscuro] = useState(() =>
    tema ? tema === "dark" : typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    if (tema) return;
    const sync = () => setEsOscuro(document.documentElement.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("secop-theme-changed", sync);
    return () => {
      obs.disconnect();
      window.removeEventListener("secop-theme-changed", sync);
    };
  }, [tema]);

  // Metal diferido: no bloquea el primer paint.
  const [metalListo, setMetalListo] = useState(false);
  useEffect(() => {
    if (reduce) return;
    let cancelar = () => {};
    const listo = () => {
      try {
        setMetalListo(!!document.createElement("canvas").getContext("webgl2"));
      } catch {
        setMetalListo(false);
      }
    };
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(listo, { timeout: 2500 });
      cancelar = () => cancelIdleCallback(id);
    } else {
      const t = setTimeout(listo, 1200);
      cancelar = () => clearTimeout(t);
    }
    return cancelar;
  }, [reduce]);

  return (
    <>
      <Background forzar={tema} />
      {!reduce && metalListo && (
        <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
          <MoltenMetal
            color1={esOscuro ? "#04231b" : "#d1fae5"}
            color2={esOscuro ? "#10b981" : "#34d399"}
            color3={esOscuro ? "#d1fae5" : "#047857"}
            colorMode={esOscuro ? "molten" : "frost"}
            lightMode={!esOscuro}
            backgroundColor={esOscuro ? "#050505" : "#fcfcfc"}
            speed={0.3}
            scale={3}
            detail={2}
            glow={1.8}
            blackPoint={0.02}
            brightness={1.45}
            opacity={esOscuro ? opacityDark : opacityLight}
            grain
            grainIntensity={0.03}
            mouseInteraction={false}
            dpr={1.25}
          />
        </div>
      )}
    </>
  );
}
