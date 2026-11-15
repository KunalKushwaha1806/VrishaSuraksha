import type { MetadataRoute } from "next";

/** Installable on a phone's home screen, so the elder can open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VridhaSuraksha",
    short_name: "VridhaSuraksha",
    description: "Elder-centred medication and care management.",
    start_url: "/app",
    display: "standalone",
    background_color: "#fffaf3",
    theme_color: "#b4410f",
    lang: "en-IN",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
