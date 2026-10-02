"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Table } from "antd";
import dayjs from "dayjs";
import { msg, useAdminT } from "@/lib/admin-i18n";

export interface DailyStat {
    day: string;
    sales: number;
    restocks: number;
    returns: number;
    adjustments: number;
}

// Categorical slots 1–2 of the validated reference palette (light surface; the admin has no dark mode).
const SERIES = [
    { key: "sales" as const, label: msg("Units sold"), short: msg("sold"), color: "#2a78d6" },
    { key: "restocks" as const, label: msg("Units restocked"), short: msg("restocked"), color: "#eb6834" },
];

const W = 760;
const H = 240;
const PAD = { top: 16, right: 96, bottom: 28, left: 40 };

/** 30-day units sold vs restocked: two 2px lines on one axis, legend + end labels, crosshair tooltip. */
export default function MovementChart({ data }: { data: DailyStat[] }) {
    const { t } = useAdminT();
    const [hover, setHover] = useState<number | null>(null);
    const [showTable, setShowTable] = useState(false);
    const svgRef = useRef<SVGSVGElement>(null);

    const { x, y, ticks } = useMemo(() => {
        const peak = Math.max(1, ...data.flatMap((d) => [d.sales, d.restocks]));
        const step = Math.pow(10, Math.floor(Math.log10(peak)));
        const niceMax = Math.ceil(peak / step) * step;
        const plotW = W - PAD.left - PAD.right;
        const plotH = H - PAD.top - PAD.bottom;
        return {
            x: (i: number) => PAD.left + (data.length <= 1 ? 0 : (i / (data.length - 1)) * plotW),
            y: (v: number) => PAD.top + plotH - (v / niceMax) * plotH,
            ticks: [0, niceMax / 2, niceMax],
        };
    }, [data]);

    if (data.length === 0) return null;

    const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
        const rect = svgRef.current!.getBoundingClientRect();
        const px = ((event.clientX - rect.left) / rect.width) * W;
        const ratio = (px - PAD.left) / (W - PAD.left - PAD.right);
        setHover(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
    };

    const last = data.length - 1;
    const hovered = hover !== null ? data[hover] : null;

    return (
        <div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                {SERIES.map((s) => (
                    <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#52514e" }}>
                        <span style={{ width: 14, height: 2, background: s.color, borderRadius: 1 }} />
                        {t(s.label)}
                    </span>
                ))}
                <Button type="link" size="small" style={{ marginInlineStart: "auto" }} onClick={() => setShowTable((v) => !v)}>
                    {showTable ? t("Show chart") : t("Show table")}
                </Button>
            </div>

            {showTable ? (
                <Table
                    size="small"
                    rowKey="day"
                    pagination={false}
                    scroll={{ y: 240 }}
                    dataSource={[...data].reverse()}
                    columns={[
                        { title: t("Day"), dataIndex: "day", render: (d: string) => dayjs(d).format("DD MMM") },
                        { title: t("Sold"), dataIndex: "sales", align: "right" },
                        { title: t("Restocked"), dataIndex: "restocks", align: "right" },
                        { title: t("Returned"), dataIndex: "returns", align: "right" },
                        { title: t("Adjusted"), dataIndex: "adjustments", align: "right" },
                    ]}
                />
            ) : (
                <div style={{ position: "relative" }}>
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${W} ${H}`}
                        width="100%"
                        role="img"
                        aria-label={t("Units sold and restocked per day over the last 30 days")}
                        onPointerMove={onMove}
                        onPointerLeave={() => setHover(null)}
                        style={{ display: "block", touchAction: "none" }}
                    >
                        {ticks.map((tick) => (
                            <g key={tick}>
                                <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#ebebea" strokeWidth={1} />
                                <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="#8a8984">{tick}</text>
                            </g>
                        ))}
                        {[0, Math.floor(last / 2), last].map((i) => (
                            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} fontSize={11} fill="#8a8984">
                                {dayjs(data[i].day).format("DD MMM")}
                            </text>
                        ))}
                        {SERIES.map((s) => (
                            <polyline
                                key={s.key}
                                fill="none"
                                stroke={s.color}
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                points={data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ")}
                            />
                        ))}
                        {/* Direct labels at the line ends, nudged apart when they would collide. */}
                        {(() => {
                            const ends = SERIES.map((s) => ({ ...s, ly: y(data[last][s.key]) }));
                            if (Math.abs(ends[0].ly - ends[1].ly) < 14) {
                                const mid = (ends[0].ly + ends[1].ly) / 2;
                                const upper = ends[0].ly <= ends[1].ly ? 0 : 1;
                                ends[upper].ly = mid - 7;
                                ends[1 - upper].ly = mid + 7;
                            }
                            return ends.map((s) => (
                                <text key={s.key} x={x(last) + 8} y={s.ly} dy="0.32em" fontSize={12} fill="#52514e">
                                    {t(s.short)} {data[last][s.key]}
                                </text>
                            ));
                        })()}
                        {hover !== null && (
                            <g pointerEvents="none">
                                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="#8a8984" strokeWidth={1} />
                                {SERIES.map((s) => (
                                    <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r={4.5} fill={s.color} stroke="#ffffff" strokeWidth={2} />
                                ))}
                            </g>
                        )}
                        <rect x={0} y={0} width={W} height={H} fill="transparent" />
                    </svg>
                    {hovered && hover !== null && (
                        <div
                            style={{
                                position: "absolute",
                                top: 8,
                                left: `${(x(hover) / W) * 100}%`,
                                transform: x(hover) > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
                                background: "#ffffff",
                                border: "1px solid #ebebea",
                                borderRadius: 8,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                padding: "8px 10px",
                                fontSize: 12,
                                pointerEvents: "none",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <div style={{ color: "#52514e", marginBottom: 4 }}>{dayjs(hovered.day).format("ddd DD MMM")}</div>
                            {SERIES.map((s) => (
                                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color }} />
                                    <strong style={{ color: "#0b0b0b" }}>{hovered[s.key]}</strong>
                                    <span style={{ color: "#52514e" }}>{t(s.short)}</span>
                                </div>
                            ))}
                            {(hovered.returns > 0 || hovered.adjustments > 0) && (
                                <div style={{ color: "#8a8984", marginTop: 2 }}>{t("{returns} returned · {adjustments} adjusted", { returns: hovered.returns, adjustments: hovered.adjustments })}</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
