"use client";

import { use } from "react";
import StaticHeader from "@/components/layout/StaticHeader";
import Footer from "@/components/footer/Footer";
import { headerConfig } from "@/lib/config";
import Image from "next/image";

type Locale = "en" | "fr" | "ar";
type CoFounder = {
    name: string;
    role: string;
    description: string;
    image: string;
};

type LocaleContent = {
    title: string;
    subtitle: string;
    sectionTitle: string;
    sectionDescription: string;
    mainHeading: string;
    mainDescription1: string;
    mainDescription2: string;
    coFounderTitle: string;
    coFounderSubtitle: string;
    coFounders: CoFounder[];
};


const content: Record<Locale, LocaleContent> = {
    en: {
        title: "About Us",
        subtitle: "Reviving the soul of tradition through handcrafted clothing.",
        sectionTitle: "About Kachabity",
        sectionDescription:
            "Kachabity celebrates the beauty of traditional and handmade garments, created with passion and inherited craftsmanship.",
        mainHeading: "A Revival of Heritage",
        mainDescription1:
            "Kachabity is more than just a brand — it’s a revival of our roots. We celebrate the timeless art of traditional and handmade clothing, crafted with love and care by the hands of our jdoud (grandparents) generations ago. These pieces carry stories, memories, and the beauty of our heritage.",
        mainDescription2:
            "Kachabity was born to honor that legacy — to preserve, recreate, and bring back to life the authentic craftsmanship that once defined our culture. Through every stitch and fabric, we reconnect the past with the present — keeping our traditions alive for generations to come.",
        coFounderTitle: "Our Co-founders",
        coFounderSubtitle: "Inspired by heritage, driven by passion.",
        coFounders: [
            {
                name: "Mounir Kraiem",
                image: '/assets/images/about/founder2.jpeg',
                role: "Co-Founder",
                description:
                    "Mounir is passionate about preserving ancestral heritage and works to ensure that every Kachabity piece carries the story and soul of our jdoud.",
            },
            {
                name: "Wael Kraiem",
                role: "Co-Founder",
                image: '/assets/images/about/founder1.jpg',

                description:
                    "Wael believes in the timeless beauty of handmade craftsmanship and leads Kachabity with a vision to blend tradition with contemporary design.",
            },

        ],
    },
    fr: {
        title: "À propos de nous",
        subtitle: "Faire revivre l’âme du patrimoine à travers des vêtements faits main.",
        sectionTitle: "À propos de Kachabity",
        sectionDescription:
            "Kachabity célèbre la beauté des vêtements traditionnels et artisanaux, créés avec passion et hérités de nos ancêtres.",
        mainHeading: "Une renaissance du patrimoine",
        mainDescription1:
            "Kachabity n’est pas qu’une simple marque — c’est une renaissance de nos racines. Nous rendons hommage à l’art intemporel des vêtements traditionnels et faits main, créés avec amour et soin par nos jdoud (grands-parents) il y a des générations. Chaque pièce porte une histoire, une mémoire et la beauté de notre héritage.",
        mainDescription2:
            "Kachabity est née pour honorer cet héritage — préserver, recréer et redonner vie à l’artisanat authentique qui définissait autrefois notre culture. À travers chaque fil et chaque tissu, nous reconnectons le passé au présent, pour que nos traditions continuent de vivre à travers le temps.",
        coFounderTitle: "Nos co-fondateurs",
        coFounderSubtitle: "Inspirés par le patrimoine, guidés par la passion.",
        coFounders: [
            {
                name: "Mounir Kraiem",
                image: '/assets/images/about/founder2.jpeg',

                role: "Co-fondateur",
                description:
                    "Passionné par la préservation du patrimoine ancestral, Mounir veille à ce que chaque pièce Kachabity raconte une histoire authentique et vivante.",
            },
            {
                name: "Wael Kraiem",
                role: "Co-fondateur",
                image: '/assets/images/about/founder1.jpg',

                description:
                    "Wael croit en la beauté intemporelle du savoir-faire artisanal et dirige Kachabity avec une vision qui allie tradition et modernité.",
            },

        ],
    },
    ar: {
        title: "من نحن",
        subtitle: "نُحيي روح التراث من خلال الأزياء التقليدية واليدوية.",
        sectionTitle: "عن كَشابِـيتي",
        sectionDescription:
            "كَشابِـيتي تحتفي بجمال الملابس التقليدية والمصنوعة يدويًا، والتي تحمل بصمة الأجداد وإبداعهم الأصيل.",
        mainHeading: "إحياء للتراث والأصالة",
        mainDescription1:
            "كَشابِـيتي ليست مجرد علامة تجارية، بل هي إحياء لجذورنا. نُكرّم الفنّ العريق في صناعة الملابس التقليدية واليدوية، التي أبدعها جدودنا بكل حبّ وإتقان منذ أجيال. هذه القطع تحمل في خيوطها قصصًا وذكريات وجمالًا من ماضينا.",
        mainDescription2:
            "وُلدت كَشابِـيتي لتُورّث الحرفة وتُعيد الحياة للصناعات التقليدية الأصيلة التي ميّزت ثقافتنا. من خلال كل غرزة ونسيج، نربط الماضي بالحاضر ونُبقي تراثنا حيًّا للأجيال القادمة.",
        coFounderTitle: "المؤسسان المشاركان",
        coFounderSubtitle: "مستوحَيان من التراث، مدفوعان بالشغف.",
        coFounders: [
            {
                name: "منير كرايم",
                role: "المؤسس المشارك",
                image: '/assets/images/about/founder2.jpeg',

                description:
                    "شغوف بالحفاظ على التراث الأصيل، ويسعى منير لأن تحمل كل قطعة من كَشابِـيتي روح الأجداد وحكايتهم.",
            },
            {
                name: "وائل كرايم",
                role: "المؤسس المشارك",
                image: '/assets/images/about/founder1.jpg',

                description:
                    "يؤمن وائل بجمال الحرفة اليدوية وأصالتها، ويقود كَشابِـيتي برؤية تمزج بين التراث والتصميم العصري.",
            },

        ],
    },
};


export default function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
    const { locale: rawLocale } = use(params);
    const locale: Locale = ["en", "fr", "ar"].includes(rawLocale as string) ? (rawLocale as Locale) : "en";
    const text = content[locale];

    return (
        <main className="min-h-screen bg-white">
            <StaticHeader />

            {/* Hero Section */}
            <section className="bg-[#FAF1EE] border-b border-neutral-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-[#5A1F16]">{text.title}</h1>
                            <p className="text-sm text-neutral-600 mt-2 max-w-xl">{text.subtitle}</p>
                        </div>
                        <p className="text-sm text-neutral-500">Home/ {text.title}</p>
                    </div>
                </div>
            </section>

            {/* About Our Artisan Shop Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-2xl font-semibold text-[#2b1a16] mb-4">{text.sectionTitle}</h2>
                    <p className="text-neutral-600 max-w-2xl mx-auto">{text.sectionDescription}</p>
                </div>

                {/* Main Content Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
                    {/* Image Column */}
                    <div className="relative">
                        <Image
                            src="/assets/images/logoKachabity.jpg"
                            alt="Kachabity team collaboration"
                            width={600}
                            height={400}
                            className="rounded-lg object-cover w-full h-full"
                        />
                    </div>

                    {/* Text Column */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-semibold text-[#2b1a16] leading-relaxed">
                            {text.mainHeading}
                        </h3>
                        <div className="space-y-4 text-neutral-700 leading-relaxed">
                            <p>{text.mainDescription1}</p>
                            <p>{text.mainDescription2}</p>
                        </div>
                    </div>
                </div>
                <div className=" flex flex-col justify-center items-center gap-4">
                    <h3 className="text-black">Our Excellent Co-founders</h3>

                    <p className="text-[#858585]">Amet minim mollit non deserunt ullamco est sit aliqua dolor do amet sint. Velit officia consequ</p>
                    <Image
                        src={'/assets/images/about/signature.svg'}
                        alt={'signature_image'}
                        width={88}
                        height={34}
                    // className="object-cover rounded-[15px]"
                    />
                </div>
                {/* Co-founder Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 justify-center">
                    {text.coFounders.map((founder) => (
                        <div key={founder.name} className="flex flex-col items-center">
                            <div className="w-48 h-48   mb-6  ">
                                <Image
                                    src={founder.image}
                                    alt={founder.name}
                                    width={192}
                                    height={192}
                                    className="object-cover w-full h-full rounded-[15px]"
                                />
                                <div className="w-full -top-11 relative bg-[#340E06] text-white px-6 py-2 rounded-b-lg mb-2 inline-block">
                                    <p className="font-semibold text-lg">{founder.name}</p>
                                </div>
                            </div>



                            <p className="text-[#7a3b2e] font-medium mb-4">{founder.role}</p>

                            <p className="text-neutral-600 max-w-md mb-6 text-center">{founder.description}</p>


                        </div>
                    ))}

                  
                </div>
                <div className="flex space-x-2 items-center justify-center">
                        {Object.entries(headerConfig.social).map(([platform, data]) => (

                            <a
                                key={platform}
                                href={data.url}
                                target="_blank"
                                rel="noopener noreferrer"

                                className="w-14 h-14 rounded-full bg-[#f5f5f5] hover:bg-[#7a3b2e] flex items-center justify-center transition-colors group"

                                aria-label={`Follow us on ${platform}`}
                            >
                                <svg className="w-6 h-6 text-[#7a3b2e] group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                                    <path d={data.icon} />
                                </svg>
                            </a>
                        ))}
                    </div>
            </section>

            <Footer />
        </main>
    );
}

