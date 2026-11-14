"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** True when animation should be skipped (reduced motion, or no IntersectionObserver). */
export function useStaticMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(QUERY).matches || !("IntersectionObserver" in window),
    () => false,
  );
}

/**
 * Scroll reveal: rises 32px and fades in once over 700ms on the weighted curve. Uses
 * IntersectionObserver (never a raw scroll listener). Reduced motion users get the final state.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const staticMotion = useStaticMotion();
  const visible = seen || staticMotion;

  useEffect(() => {
    const element = ref.current;
    if (!element || staticMotion) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [staticMotion]);

  return (
    <div
      ref={ref}
      className={cx(
        "transition duration-700 ease-weighted motion-reduce:transition-opacity",
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 motion-reduce:translate-y-0",
        className,
      )}
      style={{ transitionDelay: visible && !staticMotion ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
