import Image from "next/image";

interface ServiceHighlightCardProps {
    icon: string;
    title: string;
    description: string[];
    iconAlt?: string;
}

export default function ServiceHighlightCard({
    icon,
    title,
    description,
    iconAlt
}: ServiceHighlightCardProps) {
    return (
        <div className="bg-[#842E1B] rounded-[8px] text-white p-8 text-center w-[386px] h-[216px]">
            <div className="flex justify-center mb-4">
                <Image
                    src={icon}
                    alt={iconAlt || title}
                    width={48}
                    height={48}
                />
            </div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            {description.map((line, index) => (
                <p key={index} className="text-sm opacity-90">{line}</p>
            ))}
        </div>
    );
}

