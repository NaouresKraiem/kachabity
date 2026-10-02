import localFont from "next/font/local";

// Display face for the landing page sections: a Kufi with Arabic and Latin
// glyphs, so headings read the same in every locale. Self-hosted (variable,
// weights 400–700, Arabic + Latin subset) so builds never fetch Google Fonts.
export const reemKufi = localFont({
    src: "../app/fonts/reem-kufi-var.woff2",
    weight: "400 700",
    variable: "--font-kufi",
    display: "swap",
});
