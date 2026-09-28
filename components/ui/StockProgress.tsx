"use client";


interface StockProgressProps {
    sold: number;
    inStock: number;
}

export default function StockProgress({ sold, inStock }: StockProgressProps) {
    const total = sold + inStock;
    const percent = total > 0 ? Math.round((sold / total) * 100) : 0;

    // Change color based on percentage: red if > 60%, green otherwise
    const barColor = percent > 60 ? "#842E1B" : "#479622";

    return (
        <div className="space-y-2">
            <div className="flex justify-between ">
                <span className="text-[12px] text-gray-600 ">
                    Sold: <span className="  text-[#842E1B]">{sold}</span>
                </span>
                <span className="text-[12px] text-gray-600">
                    In Stock: <span className="text-custom12  text-[#2b1a16]">{inStock}</span>
                </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#E3E3E3]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: barColor }} />
            </div>
        </div>
    );
}

