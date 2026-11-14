import type { FormEvent } from "react";

/** Submit handler that keeps form values on failure (React form actions reset uncontrolled inputs). */
export function submitWith(handler: (form: FormData, element: HTMLFormElement) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handler(new FormData(event.currentTarget), event.currentTarget);
  };
}

export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
