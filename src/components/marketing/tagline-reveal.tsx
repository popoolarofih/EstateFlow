"use client";

import { useEffect, useRef } from "react";

/**
 * Large type tagline whose words brighten one at a time, in reading order, as each crosses a
 * trigger line at 60% of the viewport height. One IntersectionObserver watches every word.
 */
export function TaglineReveal({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const words = Array.from(root.querySelectorAll<HTMLSpanElement>("[data-word]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      words.forEach((word) => (word.dataset.active = "true"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const word = entry.target as HTMLSpanElement;
          // Active once the word is above the trigger line, including after it scrolls off the top.
          word.dataset.active = String(entry.isIntersecting || entry.boundingClientRect.top < 0);
        }
      },
      { rootMargin: "0px 0px -40% 0px", threshold: 0 },
    );
    words.forEach((word) => observer.observe(word));
    return () => observer.disconnect();
  }, []);

  return (
    <p ref={ref} className="max-w-[680px] heading-4 text-ink md:heading-2" aria-label={lines.join(" ")}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="block" aria-hidden>
          {line.split(" ").map((word, wordIndex) => (
            <span key={wordIndex} data-word className="reveal-word">
              {word}
              {wordIndex < line.split(" ").length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}
