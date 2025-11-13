"use client";

import Link from "next/link";
import type { FooterSection as FooterSectionType } from "@/lib/footer-config";

interface FooterSectionProps {
    section: FooterSectionType;
}

export default function FooterSection({ section }: FooterSectionProps) {
    return (
        <div>
            <h3 className="text-lg font-semibold text-[#2b1a16] mb-4">
                {section.title}
            </h3>
            <ul className="space-y-2">
                {section.links.map((link) => (
                    <li key={link.href}>
                        <Link
                            href={link.href}
                            className="text-gray-600 hover:text-[#842E1B] transition-colors text-sm"
                        >
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

