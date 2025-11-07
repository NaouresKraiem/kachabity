import { headerConfig } from "@/lib/config";

interface SocialLinksProps {
    className?: string;
    iconSize?: string;
}

export default function SocialLinks({
    className = "",
    iconSize = "w-10 h-10"
}: SocialLinksProps) {
    const socialLinks = [
        {
            name: "Facebook",
            url: headerConfig.social.facebook.url,
            icon: headerConfig.social.facebook.icon,
            bgColor: "bg-[#1877F2] hover:bg-[#166FE5]"
        },
        {
            name: "Instagram",
            url: headerConfig.social.instagram.url,
            icon: headerConfig.social.instagram.icon,
            bgColor: "bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] hover:opacity-90"
        },
        {
            name: "TikTok",
            url: headerConfig.social.tiktok.url,
            icon: headerConfig.social.tiktok.icon,
            bgColor: "bg-[#000000] hover:bg-[#1a1a1a]"
        }
    ];

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {socialLinks.map((social) => (
                <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${iconSize} rounded-full ${social.bgColor} flex items-center justify-center text-white transition-all duration-300`}
                    aria-label={social.name}
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d={social.icon} />
                    </svg>
                </a>
            ))}
        </div>
    );
}

