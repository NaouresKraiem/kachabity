"use client";

import { usePathname } from "next/navigation";
import StaticHeader from "@/components/layout/StaticHeader";
import Footer from "@/components/footer/Footer";
import TermsSection from "@/components/sections/TermsSection";
import { headerConfig } from "@/lib/config";

// Define content type for better type safety
interface TermsContent {
    title: string;
    subtitle: string;
    ctaMessage: string;
    ctaButton: string;
    sections: {
        [key: string]: {
            title: string;
            content: string[];
        };
    };
}

const getContent = (): Record<string, TermsContent> => ({
    en: {
        title: "Terms & Conditions",
        subtitle: "Please read these terms and conditions carefully before using our service.",
        ctaMessage: "Have questions? We're here to help!",
        ctaButton: "Contact Us",
        sections: {
            intro: {
                title: "Terms and Conditions",
                content: [
                    "Welcome to Kachabity. These terms and conditions outline the rules and regulations for the use of Kachabity's Website and services.",
                    "By accessing this website, we assume you accept these terms and conditions. Do not continue to use Kachabity if you do not agree to take all of the terms and conditions stated on this page.",
                    "The following terminology applies to these Terms and Conditions, Privacy Statement and Disclaimer Notice and all Agreements: 'Client', 'You' and 'Your' refers to you, the person log on this website and compliant to the Company's terms and conditions. 'The Company', 'Ourselves', 'We', 'Our' and 'Us', refers to our Company. 'Party', 'Parties', or 'Us', refers to both the Client and ourselves."
                ]
            },
            orders: {
                title: "Orders and Payments",
                content: [
                    "When you place an order through our website, you are offering to purchase a product subject to these Terms and Conditions. All orders are subject to availability and confirmation of the order price.",
                    "We accept payment via cash on delivery. All prices are in Tunisian Dinar (TND) and include applicable taxes unless otherwise stated.",
                    "We reserve the right to refuse any order you place with us. We may, at our sole discretion, limit or cancel quantities purchased per person, per household or per order."
                ]
            },
            shipping: {
                title: "Shipping and Delivery",
                content: [
                    "We ship to addresses within Tunisia. Shipping costs and delivery times vary based on your location and will be calculated at checkout.",
                    "We strive to deliver your products within the estimated timeframe. However, delivery times are not guaranteed and may be affected by factors beyond our control.",
                    "Risk of loss and title for items purchased pass to you upon delivery to the shipping carrier."
                ]
            },
            returns: {
                title: "Returns and Refunds",
                content: [
                    "If you are not satisfied with your purchase, you may return eligible products within 14 days of delivery for a refund or exchange.",
                    "Products must be unused, in their original packaging, and in the same condition that you received them. Handmade items may have special return conditions.",
                    "To initiate a return, please contact our customer service team at Kachabity@gmail.com with your order number and reason for return."
                ]
            },
            intellectual: {
                title: "Intellectual Property",
                content: [
                    "All content on this website, including text, graphics, logos, images, and software, is the property of Kachabity and is protected by international copyright laws.",
                    "You may not reproduce, distribute, modify, or create derivative works of our content without our express written permission."
                ]
            },
            liability: {
                title: "Limitation of Liability",
                content: [
                    "Kachabity shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of or inability to use the service.",
                    "Our total liability to you for all claims arising from or related to the service shall not exceed the amount you paid to us for the products."
                ]
            },
            privacy: {
                title: "Privacy Policy",
                content: [
                    "Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your personal information when you use our website and services.",
                    "By using our website, you consent to our Privacy Policy and agree to its terms."
                ]
            },
            changes: {
                title: "Changes to Terms",
                content: [
                    "We reserve the right to modify these terms and conditions at any time. Changes will be effective immediately upon posting to the website.",
                    "Your continued use of the website following the posting of changes constitutes your acceptance of such changes."
                ]
            },
            contact: {
                title: "Contact Us",
                content: [
                    "If you have any questions about these Terms and Conditions, please contact us:",
                    `Email: ${headerConfig.contact.email}`,
                    `Phone: ${headerConfig.contact.phone}`
                ]
            }
        }
    },
    fr: {
        title: "Termes et Conditions",
        subtitle: "Veuillez lire attentivement ces termes et conditions avant d'utiliser notre service.",
        ctaMessage: "Vous avez des questions ? Nous sommes là pour vous aider !",
        ctaButton: "Contactez-nous",
        sections: {
            intro: {
                title: "Termes et Conditions",
                content: [
                    "Bienvenue sur Kachabity. Ces termes et conditions décrivent les règles et réglementations pour l'utilisation du site Web et des services de Kachabity.",
                    "En accédant à ce site Web, nous supposons que vous acceptez ces termes et conditions. Ne continuez pas à utiliser Kachabity si vous n'acceptez pas tous les termes et conditions énoncés sur cette page.",
                    "La terminologie suivante s'applique à ces Termes et Conditions, Déclaration de confidentialité et Avis de non-responsabilité : 'Client', 'Vous' et 'Votre' se réfèrent à vous, la personne qui se connecte à ce site Web."
                ]
            },
            orders: {
                title: "Commandes et Paiements",
                content: [
                    "Lorsque vous passez une commande sur notre site Web, vous proposez d'acheter un produit sous réserve de ces Termes et Conditions.",
                    "Nous acceptons le paiement par paiement à la livraison. Tous les prix sont en Dinar Tunisien (TND) et incluent les taxes applicables sauf indication contraire.",
                    "Nous nous réservons le droit de refuser toute commande que vous passez avec nous."
                ]
            },
            shipping: {
                title: "Expédition et Livraison",
                content: [
                    "Nous expédions aux adresses en Tunisie. Les frais d'expédition et les délais de livraison varient en fonction de votre emplacement.",
                    "Nous nous efforçons de livrer vos produits dans les délais estimés. Cependant, les délais de livraison ne sont pas garantis.",
                    "Le risque de perte et le titre des articles achetés vous sont transférés lors de la livraison au transporteur."
                ]
            },
            returns: {
                title: "Retours et Remboursements",
                content: [
                    "Si vous n'êtes pas satisfait de votre achat, vous pouvez retourner les produits éligibles dans les 14 jours suivant la livraison.",
                    "Les produits doivent être inutilisés, dans leur emballage d'origine et dans le même état que vous les avez reçus.",
                    "Pour initier un retour, veuillez contacter notre service client à Kachabity@gmail.com."
                ]
            },
            intellectual: {
                title: "Propriété Intellectuelle",
                content: [
                    "Tout le contenu de ce site Web est la propriété de Kachabity et est protégé par les lois internationales sur le droit d'auteur.",
                    "Vous ne pouvez pas reproduire, distribuer ou modifier notre contenu sans notre permission écrite expresse."
                ]
            },
            liability: {
                title: "Limitation de Responsabilité",
                content: [
                    "Kachabity ne sera pas responsable des dommages indirects, accessoires ou consécutifs résultant de votre utilisation du service.",
                    "Notre responsabilité totale envers vous ne dépassera pas le montant que vous nous avez payé pour les produits."
                ]
            },
            privacy: {
                title: "Politique de Confidentialité",
                content: [
                    "Votre vie privée est importante pour nous. Notre Politique de confidentialité explique comment nous collectons et protégeons vos informations personnelles.",
                    "En utilisant notre site Web, vous consentez à notre Politique de confidentialité."
                ]
            },
            changes: {
                title: "Modifications des Conditions",
                content: [
                    "Nous nous réservons le droit de modifier ces termes et conditions à tout moment.",
                    "Votre utilisation continue du site Web constitue votre acceptation de ces modifications."
                ]
            },
            contact: {
                title: "Nous Contacter",
                content: [
                    "Si vous avez des questions concernant ces Termes et Conditions, veuillez nous contacter :",
                    `Email : ${headerConfig.contact.email}`,
                    `Téléphone : ${headerConfig.contact.phone}`
                ]
            }
        }
    },
    ar: {
        title: "الشروط والأحكام",
        subtitle: "يرجى قراءة هذه الشروط والأحكام بعناية قبل استخدام خدمتنا.",
        ctaMessage: "هل لديك أسئلة؟ نحن هنا للمساعدة!",
        ctaButton: "اتصل بنا",
        sections: {
            intro: {
                title: "الشروط والأحكام",
                content: [
                    "مرحبا بكم في كشابيتي. توضح هذه الشروط والأحكام القواعد واللوائح الخاصة باستخدام موقع وخدمات كشابيتي.",
                    "من خلال الوصول إلى هذا الموقع، نفترض أنك تقبل هذه الشروط والأحكام. لا تستمر في استخدام كشابيتي إذا كنت لا توافق على جميع الشروط والأحكام المذكورة في هذه الصفحة.",
                    "تنطبق المصطلحات التالية على هذه الشروط والأحكام وبيان الخصوصية وإشعار إخلاء المسؤولية."
                ]
            },
            orders: {
                title: "الطلبات والمدفوعات",
                content: [
                    "عند تقديم طلب من خلال موقعنا، فإنك تعرض شراء منتج وفقًا لهذه الشروط والأحكام.",
                    "نحن نقبل الدفع عند الاستلام. جميع الأسعار بالدينار التونسي وتشمل الضرائب المطبقة ما لم ينص على خلاف ذلك.",
                    "نحتفظ بالحق في رفض أي طلب تقدمه معنا."
                ]
            },
            shipping: {
                title: "الشحن والتسليم",
                content: [
                    "نحن نشحن إلى العناوين داخل تونس. تختلف تكاليف الشحن وأوقات التسليم بناءً على موقعك.",
                    "نسعى جاهدين لتسليم منتجاتك خلال الإطار الزمني المقدر. ومع ذلك، فإن أوقات التسليم غير مضمونة.",
                    "ينتقل خطر الخسارة والملكية للمنتجات المشتراة إليك عند التسليم إلى شركة الشحن."
                ]
            },
            returns: {
                title: "المرتجعات والمبالغ المستردة",
                content: [
                    "إذا لم تكن راضيًا عن عملية الشراء، يمكنك إرجاع المنتجات المؤهلة في غضون 14 يومًا من التسليم.",
                    "يجب أن تكون المنتجات غير مستخدمة وفي عبوتها الأصلية وبنفس الحالة التي استلمتها بها.",
                    "لبدء الإرجاع، يرجى الاتصال بفريق خدمة العملاء على Kachabity@gmail.com."
                ]
            },
            intellectual: {
                title: "الملكية الفكرية",
                content: [
                    "جميع المحتويات على هذا الموقع هي ملك لكشابيتي ومحمية بموجب قوانين حقوق النشر الدولية.",
                    "لا يجوز لك إعادة إنتاج أو توزيع أو تعديل المحتوى الخاص بنا دون إذن كتابي صريح منا."
                ]
            },
            liability: {
                title: "حدود المسؤولية",
                content: [
                    "لن تكون كشابيتي مسؤولة عن أي أضرار غير مباشرة أو عرضية أو خاصة ناتجة عن استخدامك للخدمة.",
                    "لن تتجاوز مسؤوليتنا الإجمالية تجاهك المبلغ الذي دفعته لنا مقابل المنتجات."
                ]
            },
            privacy: {
                title: "سياسة الخصوصية",
                content: [
                    "خصوصيتك مهمة بالنسبة لنا. توضح سياسة الخصوصية الخاصة بنا كيفية جمع معلوماتك الشخصية وحمايتها.",
                    "باستخدام موقعنا، فإنك توافق على سياسة الخصوصية الخاصة بنا."
                ]
            },
            changes: {
                title: "التغييرات على الشروط",
                content: [
                    "نحتفظ بالحق في تعديل هذه الشروط والأحكام في أي وقت.",
                    "يشكل استمرارك في استخدام الموقع قبولك لهذه التغييرات."
                ]
            },
            contact: {
                title: "اتصل بنا",
                content: [
                    "إذا كان لديك أي أسئلة حول هذه الشروط والأحكام، يرجى الاتصال بنا:",
                    `البريد الإلكتروني: ${headerConfig.contact.email}`,
                    `الهاتف: ${headerConfig.contact.phone}`
                ]
            }
        }
    }
});

export default function TermsAndConditions() {
    const pathname = usePathname();

    // Extract locale from pathname
    const locale = pathname?.split('/')[1] || 'en';
    const validLocale = ['en', 'fr', 'ar'].includes(locale) ? locale : 'en';

    const content = getContent();
    const text = content[validLocale] || content.en;

    return (
        <>
            <StaticHeader />

            <div className="min-h-screen bg-gray-50">
                {/* Hero Section */}
                <div className="">
                    <div className="max-w-7xl mx-auto px-1 py-16 text-center   border-b-5 border-[#FCF1EE]">
                        <h1 className=" md:text-4xl font-bold text-gray-900 mb-4">
                            {text.title}
                        </h1>
                        <p className=" text-gray-600 max-w-2xl mx-auto">
                            {text.subtitle}
                        </p>
                        {/* <p className="text-sm text-gray-500 mt-4">
                            {text.lastUpdated}: {new Date().toLocaleDateString(validLocale === 'ar' ? 'ar-TN' : validLocale === 'fr' ? 'fr-FR' : 'en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p> */}
                    </div>
                </div>

                {/* Content Section */}
                <div className="max-w-7xl mx-auto py-12">
                    <div>
                        {/* Dynamically render all sections */}
                        {Object.entries(text.sections).map(([key, section], index) => (
                            <TermsSection
                                key={key}
                                title={section.title}
                                content={section.content}
                                isFirst={index === 0}
                            />
                        ))}

                        {/* Contact CTA */}
                        <div className="mt-12 p-6 bg-linear-to-r from-[#7a3b2e] to-[#5e2d23] rounded-lg text-center">
                            <p className="text-white mb-4 text-lg">
                                {text.ctaMessage}
                            </p>
                            <a
                                href={`mailto:${headerConfig.contact.email}`}
                                className="inline-block px-8 py-3 bg-white text-[#7a3b2e] font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                {text.ctaButton}
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </>
    );
}

