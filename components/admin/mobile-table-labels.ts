"use client";

import { useEffect } from "react";

/**
 * On phones, admin tables are shown as stacked cards (CSS in app/admin/layout.tsx, under
 * `.admin-mobile`). Each cell needs its column title as a label; antd doesn't render one,
 * so this copies the header text onto every body cell as `data-label`, and keeps doing so
 * as tables load, paginate or expand.
 */
function labelTables(root: HTMLElement) {
    root.querySelectorAll<HTMLTableElement>(".ant-table table").forEach((table) => {
        const headerRow = table.querySelector("thead tr:last-child");
        if (!headerRow) return;
        // Column index -> title, expanding colSpans so indexes line up with body cells.
        const titles: string[] = [];
        headerRow.querySelectorAll<HTMLTableCellElement>("th").forEach((th) => {
            const isControl = th.classList.contains("ant-table-selection-column") || th.classList.contains("ant-table-row-expand-icon-cell");
            const text = isControl ? "" : (th.querySelector(".ant-table-column-title")?.textContent ?? th.textContent ?? "").trim();
            for (let i = 0; i < (th.colSpan || 1); i++) titles.push(text);
        });
        table.querySelectorAll<HTMLTableRowElement>(":scope > tbody > tr").forEach((row) => {
            if (row.classList.contains("ant-table-expanded-row") || row.classList.contains("ant-table-placeholder") || row.classList.contains("ant-table-measure-row")) return;
            let index = 0;
            row.querySelectorAll<HTMLTableCellElement>(":scope > td").forEach((td) => {
                const label = titles[index] ?? "";
                if (td.getAttribute("data-label") !== label) td.setAttribute("data-label", label);
                index += td.colSpan || 1;
            });
        });
    });
}

export function useMobileTableLabels(root: HTMLElement | null, enabled: boolean) {
    useEffect(() => {
        if (!root || !enabled) return;
        let frame = 0;
        const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => labelTables(root));
        };
        schedule();
        const observer = new MutationObserver(schedule);
        observer.observe(root, { childList: true, subtree: true });
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [root, enabled]);
}
