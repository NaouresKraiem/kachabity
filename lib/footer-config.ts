export interface FooterLink {
    label: string;
    href: string;
}

export interface FooterSection {
    title: string;
    links: FooterLink[];
}

export const footerConfig = {
    brand: {
        name: "Kachabity",
        tagline: "Discover authentic Tunisian handcrafted products and traditional treasures.",
        logo: "/assets/images/logo.svg",
        sublogo: "/assets/images/logoKachabity.jpg"
    },

    sections: [
        {
            title: "Quick Links",
            links: [
                { label: "Categories", href: "/categories" },
                { label: "Discounts", href: "/discounts" },
                { label: "New Arrivals", href: "/new" },
                { label: "Best Sellers", href: "/bestsellers" }
            ]
        },
        {
            title: "About",
            links: [
                { label: "About Us", href: "/about" },
                { label: "Contact", href: "/contact" },
                { label: "FAQs", href: "/faqs" }
            ]
        },
        {
            title: "Legal",
            links: [
                { label: "Terms & Conditions", href: "/terms-and-conditions" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Shipping Policy", href: "/shipping" }
            ]
        }
    ],

    newsletter: {
        title: "Subscribe to our newsletter",
        subtitle: "Get the latest updates on new products and exclusive offers",
        placeholder: "Enter your email"
    },

    copyright: {
        year: new Date().getFullYear(),
        text: "Kachabity. All rights reserved."
    }
};