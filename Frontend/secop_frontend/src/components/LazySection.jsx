import { useEffect, useRef, useState } from "react";

// LazySection — monta los hijos solo cuando se acercan al viewport.
// Qué: IntersectionObserver con rootMargin 400px, una sola vez.
// Por qué: el dashboard disparaba ~12 queries a la vez contra runserver (1 hilo)
// y StrictMode las duplica en dev. Lo bajo el fold ahora pide al hacer scroll.
export default function LazySection({ children, minHeight = 220, label }) {
  const ref = useRef(null);
  // Sin IntersectionObserver (navegador viejo): visible desde el inicio, sin setState en efecto.
  const [visible, setVisible] = useState(
    () => typeof window === "undefined" || !("IntersectionObserver" in window),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  if (visible) return <>{children}</>;
  return (
    <div
      ref={ref}
      aria-label={label ?? "Cargando sección"}
      style={{ minHeight }}
      className="rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 animate-pulse bg-white/50 dark:bg-zinc-900/50"
    />
  );
}
