import { useRef, useEffect, useState } from "react";
import { animate } from "animejs";
import { useReducedMotion } from "motion/react";

// Uiverse + animejs — input con floating label + line drawing + shake error
// Mantiene aria: label htmlFor + input id para que getByLabelText funcione en tests
export default function UiverseInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  required,
  autoComplete,
  error,
  icon: Icon,
  onIconClick,
  iconLabel,
  delay = 0,
}) {
  const wrapRef = useRef(null);
  const labelRef = useRef(null);
  const lineRef = useRef(null);
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [hasAutofill, setHasAutofill] = useState(false);
  const hasValue = String(value ?? "").length > 0 || hasAutofill;
  const floated = focused || hasValue;
  const reduce = useReducedMotion();

  // cross-browser autofill detection: Chrome/Safari autofill no dispara onChange en controlled inputs
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // check inicial por si el navegador ya autocompletó antes de montar
    if (el.value && !hasValue) setHasAutofill(true);
    const onAnimStart = (e) => {
      if (e.animationName === "onAutoFillStart") setHasAutofill(true);
      if (e.animationName === "onAutoFillCancel") setHasAutofill(false);
    };
    el.addEventListener("animationstart", onAnimStart);
    // Firefox no usa animation, pero dispara input event
    const onInput = () => {
      if (el.value && !String(value ?? "").length) setHasAutofill(!!el.value);
      else if (!el.value) setHasAutofill(false);
    };
    el.addEventListener("input", onInput);
    return () => {
      el.removeEventListener("animationstart", onAnimStart);
      el.removeEventListener("input", onInput);
    };
  }, [value, hasValue]);

  // stagger entrance — uiverse bento feel + animejs, respeta reduced-motion + cleanup
  useEffect(() => {
    if (!wrapRef.current) return;
    if (reduce) {
      wrapRef.current.style.opacity = "1";
      wrapRef.current.style.transform = "translateY(0)";
      return;
    }
    const anim = animate(wrapRef.current, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 420,
      delay,
      easing: "easeOutExpo",
    });
    return () => anim?.pause?.();
  }, [delay, reduce]);

  // floating label morph — cleanup + reduced
  useEffect(() => {
    if (!labelRef.current) return;
    if (reduce) {
      labelRef.current.style.transform = `translateY(${floated ? -22 : 0}px) scale(${floated ? 0.82 : 1})`;
      labelRef.current.style.color = error ? "#dc2626" : focused ? "#059669" : "#71717a";
      return;
    }
    const anim = animate(labelRef.current, {
      translateY: floated ? -22 : 0,
      scale: floated ? 0.82 : 1,
      color: error ? "#dc2626" : focused ? "#059669" : "#71717a",
      duration: 280,
      easing: "easeOutExpo",
    });
    return () => anim?.pause?.();
  }, [floated, focused, error, reduce]);

  function onFocus() {
    setFocused(true);
    if (reduce || !lineRef.current) return;
    animate(lineRef.current, {
      width: ["0%", "100%"],
      left: ["50%", "0%"],
      duration: 320,
      easing: "easeOutExpo",
    });
  }
  function onBlur() {
    setFocused(false);
    if (reduce || !lineRef.current || hasValue) return;
    animate(lineRef.current, {
      width: ["100%", "0%"],
      left: ["0%", "50%"],
      duration: 260,
      easing: "easeInExpo",
    });
  }

  // shake on error — animejs, respeta reduced
  useEffect(() => {
    if (!error || !wrapRef.current || reduce) return;
    const anim = animate(wrapRef.current, {
      translateX: [0, -6, 6, -4, 4, 0],
      duration: 420,
      easing: "easeInOutQuad",
    });
    return () => anim?.pause?.();
  }, [error, reduce]);

  return (
    <div ref={wrapRef} className="space-y-1.5 opacity-0" style={{ willChange: "transform, opacity" }}>
      {/* cross-browser autofill + normalize — Chrome/Safari/Firefox/Edge */}
      <style>{`
        @keyframes onAutoFillStart{from{}to{}} @keyframes onAutoFillCancel{from{}to{}}
        input:-webkit-autofill{animation-name:onAutoFillStart;animation-duration:0.01s}
        input:not(:-webkit-autofill){animation-name:onAutoFillCancel;animation-duration:0.01s}
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus{ -webkit-text-fill-color:#18181b; -webkit-box-shadow:0 0 0 1000px #ffffff inset; transition:background-color 5000s ease-in-out 0s; caret-color:#18181b; }
        .dark input:-webkit-autofill, .dark input:-webkit-autofill:hover, .dark input:-webkit-autofill:focus{ -webkit-text-fill-color:#f4f4f5; -webkit-box-shadow:0 0 0 1000px #27272a inset; caret-color:#f4f4f5; }
        input:autofill{ background-color:#fff !important; color:#18181b !important; }
        @supports (-webkit-touch-callout: none){ input{ font-size:16px; } } /* iOS Safari 16px evita zoom */
      `}</style>
      <div className="relative group">
        {/* label flotante — uiverse con fondo para cubrir borde en dark */}
        <label
          ref={labelRef}
          htmlFor={id}
          className={`absolute left-3.5 top-3.5 text-sm font-medium tracking-wide pointer-events-none origin-left z-10 select-none px-0 ${floated ? "bg-white dark:bg-zinc-800 px-1.5 -ml-1 rounded" : ""}`}
          style={{ color: "#71717a" }}
        >
          {label}
        </label>

        <input
          ref={inputRef}
          id={id}
          type={type}
          value={value}
          onChange={(e) => { setHasAutofill(false); onChange?.(e); }}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={floated ? placeholder : " "}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          // cross-browser + texto interior suave al enfocar (sin explosión: solo 0.5px + tracking)
          style={{
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
            WebkitBackdropFilter: "blur(12px)",
            backdropFilter: "blur(12px)",
            boxSizing: "border-box",
            transition: "all 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
          className={`peer w-full h-[52px] rounded-xl border bg-white/80 dark:bg-zinc-800/80 backdrop-blur px-3.5 pt-3 focus:outline-none autofill:bg-white autofill:text-zinc-900
            ${focused ? "text-[14.5px] tracking-[-0.008em]" : "text-sm tracking-wide"}
            ${error ? "border-red-300 dark:border-red-800 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-zinc-900 dark:text-white placeholder:text-zinc-400" : "border-zinc-200 dark:border-zinc-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 text-zinc-900 dark:text-white placeholder:text-zinc-400"}
            ${Icon ? "pr-10" : "pr-3.5"}`}
        />

        {/* underline draw — animejs line drawing */}
        <span
          ref={lineRef}
          aria-hidden
          className="absolute bottom-0 left-1/2 h-[2px] w-0 rounded-full pointer-events-none"
          style={{ background: error ? "#dc2626" : "#059669" }}
        />

        {/* icon acción (ver clave) */}
        {Icon && (
          <button
            type="button"
            onClick={onIconClick}
            aria-label={iconLabel}
            tabIndex={-1}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 grid place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
          >
            <Icon size={16} />
          </button>
        )}

        {/* glow sutil uiverse — solo focus */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-300 ${focused ? "opacity-100" : "opacity-0"}`}
          style={{ boxShadow: error ? "0 0 0 4px rgba(220,38,38,0.08)" : "0 0 0 4px rgba(16,185,129,0.08)" }}
        />
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400 px-1">
          {error}
        </p>
      )}
    </div>
  );
}
