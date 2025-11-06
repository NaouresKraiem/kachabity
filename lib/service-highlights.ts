import { headerConfig } from "./config";

export interface ServiceHighlight {
    icon: string;
    title: string;
    description: string[];
}

export const getServiceHighlights = (): ServiceHighlight[] => [
    {
        icon: "/assets/images/icons/shipping.svg",
        title: "Free Shipping",
        description: [
            "For invoices",
            `over ${headerConfig.invoices.free_shipping_threshold} ${headerConfig.invoices.currency}`
        ]
    },
    {
        icon: "/assets/images/icons/cash.svg",
        title: "Cash Back",
        description: [
            "When paying for products",
            "via Dasun Wallet"
        ]
    },
    {
        icon: "/assets/images/icons/supportt.svg",
        title: "24/7 Support",
        description: [
            "When something goes",
            "wrong"
        ]
    }
];

