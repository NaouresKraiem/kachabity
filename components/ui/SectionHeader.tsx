interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    className?: string;
}

export default function SectionHeader({ title, subtitle, className = "" }: SectionHeaderProps) {
    return (
        <div className={`text-center mb-12 ${className}`}>
            <h2 className="text-4xl font-bold text-[#000000] mb-2">
                {title}
            </h2>
            {subtitle && (
                <p className="text-gray-500 text-base">
                    {subtitle}
                </p>
            )}
        </div>
    );
}

