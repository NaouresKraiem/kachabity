import { Reem_Kufi } from "next/font/google";

// Display face for the landing page sections: a Kufi with Arabic and Latin
// glyphs, so headings read the same in every locale.
export const reemKufi = Reem_Kufi({
    subsets: ["arabic", "latin"],
    weight: ["500", "600", "700"],
    variable: "--font-kufi",
    display: "swap",
});
