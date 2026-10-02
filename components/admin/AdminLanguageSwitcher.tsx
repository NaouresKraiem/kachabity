"use client";

import { Segmented } from "antd";
import { ADMIN_LOCALES, useAdminT, type AdminLocale } from "@/lib/admin-i18n";

/** EN / FR / ع switch for the admin dashboard language. */
export default function AdminLanguageSwitcher() {
    const { locale, setLocale, t } = useAdminT();
    return (
        <Segmented
            size="small"
            value={locale}
            onChange={(value) => setLocale(value as AdminLocale)}
            options={ADMIN_LOCALES.map((l) => ({ value: l.value, label: l.label }))}
            aria-label={t("Language")}
        />
    );
}
