import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Kachabity",
        short_name: "Kachabity",
        description: "Kachabity handcrafted products and order management",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
            {
                src: "/assets/images/logoKachabitybg.png",
                sizes: "192x192",
                type: "image/png",
            },
        ],
    };
}
