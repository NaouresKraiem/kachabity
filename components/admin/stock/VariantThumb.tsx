"use client";

import Image from "next/image";

/** Small square photo of a variant (or its product), with a neutral placeholder. */
export default function VariantThumb({ src, size = 40 }: { src: string | null; size?: number }) {
    const style = { width: size, height: size, borderRadius: 6, flexShrink: 0 } as const;
    return src ? (
        <Image src={src} alt="" width={size} height={size} sizes={`${size * 2}px`} style={{ ...style, objectFit: "cover" }} />
    ) : (
        <span style={{ ...style, display: "inline-block", background: "#f0f0f0" }} />
    );
}
