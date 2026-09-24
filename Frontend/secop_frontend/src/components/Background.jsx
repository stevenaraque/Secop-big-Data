// Fondo "aurora + retícula + constelación" para SECOP Insight.
// 0 JS en runtime: puro CSS. Solo se animan transform/opacity (compositado GPU).
// Los tintes cambian con la clase `dark` de Tailwind (la que maneja tu ThemeToggle).
// Se pausa todo con prefers-reduced-motion.

const css = `
.fondo-secop{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;contain:layout paint}

/* Luz cenital: conecta con el header */
.spot{position:absolute;inset:0;background:radial-gradient(110% 55% at 50% -8%,rgba(16,185,129,.07),transparent 62%)}
.dark .spot{background:radial-gradient(110% 55% at 50% -8%,rgba(16,185,129,.10),transparent 60%)}

/* Aurora: 3 orbes en deriva lenta (radial-gradient, sin filter:blur) */
.orbe{position:absolute;border-radius:50%;will-change:transform}
.orbe-a{width:62vmax;height:62vmax;top:-28vmax;left:-16vmax;background:radial-gradient(circle at center,rgba(16,185,129,.10),transparent 64%);animation:deriva-a 54s ease-in-out infinite alternate}
.orbe-b{width:54vmax;height:54vmax;bottom:-24vmax;right:-14vmax;background:radial-gradient(circle at center,rgba(56,189,248,.09),transparent 64%);animation:deriva-b 68s ease-in-out infinite alternate}
.orbe-c{width:44vmax;height:44vmax;top:26%;left:38%;background:radial-gradient(circle at center,rgba(168,85,247,.055),transparent 62%);animation:deriva-c 82s ease-in-out infinite alternate}
.dark .orbe-a{background:radial-gradient(circle at center,rgba(16,185,129,.17),transparent 64%)}
.dark .orbe-b{background:radial-gradient(circle at center,rgba(56,189,248,.13),transparent 64%)}
.dark .orbe-c{background:radial-gradient(circle at center,rgba(168,85,247,.09),transparent 62%)}

@keyframes deriva-a{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(6vw,5vh,0) scale(1.14)}}
@keyframes deriva-b{from{transform:translate3d(0,0,0) scale(1.08)}to{transform:translate3d(-7vw,-4vh,0) scale(1)}}
@keyframes deriva-c{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(-5vw,6vh,0) scale(1.18)}}

/* Constelación (eco del Grafo), solo desktop */
.red{position:absolute;top:-30px;right:-50px;width:min(46vw,560px);color:rgba(5,150,105,.20);transform:rotate(3deg)}
.dark .red{color:rgba(52,211,153,.30)}
@media (max-width:767px){.red{display:none}}

.nodo-pulso{animation:pulso 5s ease-in-out infinite}
.nodo-pulso.b{animation-delay:1.6s}
.nodo-pulso.c{animation-delay:3.1s}
@keyframes pulso{0%,100%{opacity:.35}50%{opacity:1}}

/* Grano feTurbulence (evita banding en los degradados) */
.ruido{position:absolute;inset:0;opacity:.035;background-size:256px 256px;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")}
.dark .ruido{opacity:.025}

@media (prefers-reduced-motion:reduce){.orbe,.nodo-pulso{animation:none !important}}

/* Tema forzado: gana a la clase .dark de <html> por ir después (misma
   especificidad, último en cascada). Para loaders que congelan el tema
   con el que entraron aunque el usuario lo cambie a mitad de carga. */
.forzar-dark .spot{background:radial-gradient(110% 55% at 50% -8%,rgba(16,185,129,.10),transparent 60%)}
.forzar-dark .orbe-a{background:radial-gradient(circle at center,rgba(16,185,129,.17),transparent 64%)}
.forzar-dark .orbe-b{background:radial-gradient(circle at center,rgba(56,189,248,.13),transparent 64%)}
.forzar-dark .orbe-c{background:radial-gradient(circle at center,rgba(168,85,247,.09),transparent 62%)}
.forzar-dark .red{color:rgba(52,211,153,.30)}
.forzar-dark .ruido{opacity:.025}
.forzar-light .spot{background:radial-gradient(110% 55% at 50% -8%,rgba(16,185,129,.07),transparent 62%)}
.forzar-light .orbe-a{background:radial-gradient(circle at center,rgba(16,185,129,.10),transparent 64%)}
.forzar-light .orbe-b{background:radial-gradient(circle at center,rgba(56,189,248,.09),transparent 64%)}
.forzar-light .orbe-c{background:radial-gradient(circle at center,rgba(168,85,247,.055),transparent 62%)}
.forzar-light .red{color:rgba(5,150,105,.20)}
.forzar-light .ruido{opacity:.035}
`;

export default function Background({ forzar = null }) {
  return (
    <div className={`fondo-secop${forzar ? ` forzar-${forzar}` : ""}`} aria-hidden="true">
      <style>{css}</style>
      <div className="spot" />
      <div className="orbe orbe-a" />
      <div className="orbe orbe-b" />
      <div className="orbe orbe-c" />
      <svg className="red" viewBox="0 0 600 420" fill="none">
        <g stroke="currentColor" strokeWidth="1" opacity="0.7">
          <path d="M80 300 L170 210 L260 260 L350 150 L430 210 L520 110 L560 220" />
          <path d="M430 210 L470 300 M260 260 L300 60 L350 150 M430 210 L560 220" />
        </g>
        <g fill="currentColor">
          <circle cx="80" cy="300" r="3" className="nodo-pulso" />
          <circle cx="170" cy="210" r="2.5" />
          <circle cx="260" cy="260" r="3" className="nodo-pulso b" />
          <circle cx="300" cy="60" r="2.5" />
          <circle cx="350" cy="150" r="3" className="nodo-pulso c" />
          <circle cx="430" cy="210" r="3.5" className="nodo-pulso" />
          <circle cx="470" cy="300" r="2.5" />
          <circle cx="520" cy="110" r="3" />
          <circle cx="560" cy="220" r="2.5" className="nodo-pulso b" />
        </g>
      </svg>
      <div className="ruido" />
    </div>
  );
}
