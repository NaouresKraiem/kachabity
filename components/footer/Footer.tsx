import Image from "next/image";
import Link from "next/link";
import { headerConfig } from "@/lib/config";
import { footerConfig } from "@/lib/footer-config";
import SocialLinks from "../sections/SocialLinks";
import FooterSection from "./FooterSection";
import NewsletterForm from "../sections/NewsletterForm";

export default function Footer() {
    return (
        <footer className="w-full bg-white border-t border-[#842E1B]">
            <div className="max-w-7xl mx-auto px-4 py-12">
                {/* Main Footer Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 mb-12">
                    {/* Brand Section */}
                    <div className="lg:col-span-3">
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <Image
                                src={footerConfig.brand.logo}
                                alt={footerConfig.brand.name}
                                width={120}
                                height={40}
                                className="h-10 w-auto"
                            />
                            <Image
                                src={footerConfig.brand.sublogo}
                                alt={footerConfig.brand.name}
                                width={40}
                                height={40}
                                className="rounded"
                            />
                        </Link>
                        <p className="text-gray-600 text-sm mb-6 max-w-sm">
                            {footerConfig.brand.tagline}
                        </p>
                        <SocialLinks />
                    </div>

                    {/* Footer Sections */}
                    <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-8">
                        {footerConfig.sections.map((section, index) => (
                            <FooterSection key={index} section={section} />
                        ))}
                    </div>

                    {/* Newsletter Section */}
                    <div className="lg:col-span-3">
                        <div className="text-[#2b1a16]">
                            <NewsletterForm
                                title={footerConfig.newsletter.title}
                                subtitle={footerConfig.newsletter.subtitle}
                                placeholder={footerConfig.newsletter.placeholder}
                            />
                        </div>
                    </div>
                </div>

                {/* Copyright and Contact Section */}
                <div className="border-t border-gray-200 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        {/* Copyright */}
                        <p className="text-gray-500 text-sm text-center md:text-left">
                            © {footerConfig.copyright.year} {footerConfig.copyright.text}
                        </p>

                        {/* Contact Info */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-sm text-gray-600">
                            <a
                                href={`tel:${headerConfig.contact.phone}`}
                                className="flex items-center gap-2 hover:text-[#842E1B] transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {headerConfig.contact.phone}
                            </a>
                            <a
                                href={`mailto:${headerConfig.contact.email}`}
                                className="flex items-center gap-2 hover:text-[#842E1B] transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {headerConfig.contact.email}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}