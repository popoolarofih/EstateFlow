import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EstateFlow",
    short_name: "EstateFlow",
    description: "Visitor passes, estate dues and maintenance for your estate.",
    start_url: "/sign-in",
    display: "standalone",
    background_color: "#F4F7FB",
    theme_color: "#101B35",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
