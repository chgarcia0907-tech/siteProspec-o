import { useEffect, useRef, type ComponentProps } from "react";

/**
 * Seção cujas partes (classe `reveal`, com `--i` para a ordem) entram uma vez quando ela aparece
 * na tela. Sem script, nada fica escondido: a seção só se arma depois de montar.
 */
export function Reveal({ children, ...props }: ComponentProps<"section">) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    el.dataset["armed"] = "";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset["shown"] = "";
        io.disconnect();
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={ref} {...props}>
      {children}
    </section>
  );
}
