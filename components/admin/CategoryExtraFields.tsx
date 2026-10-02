"use client";

import { useEffect, useState } from "react";
import { Col, Form, Input, Row, Select } from "antd";
import { useAdminT } from "@/lib/admin-i18n";

interface CategoryOption {
    id: string;
    name: string;
    parent_id: string | null;
}

interface CategoryExtraFieldsProps {
    /** The category being edited: it and its descendants can't be chosen as its parent. */
    excludeId?: string;
}

/** Translated names and parent category, shared by the create and edit category forms. */
export default function CategoryExtraFields({ excludeId }: CategoryExtraFieldsProps) {
    const { t } = useAdminT();
    const [categories, setCategories] = useState<CategoryOption[]>([]);

    useEffect(() => {
        fetch("/api/categories")
            .then((res) => res.json())
            .then((result) => setCategories(result.success ? result.data : []))
            .catch(() => setCategories([]));
    }, []);

    const excluded = new Set<string>();
    if (excludeId) {
        excluded.add(excludeId);
        for (let grew = true; grew; ) {
            grew = false;
            for (const c of categories) {
                if (c.parent_id && excluded.has(c.parent_id) && !excluded.has(c.id)) {
                    excluded.add(c.id);
                    grew = true;
                }
            }
        }
    }

    return (
        <>
            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item label={t("Name (Arabic)")} name="name_ar">
                        <Input dir="rtl" placeholder="اسم الفئة" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item label={t("Name (French)")} name="name_fr">
                        <Input placeholder={t("Nom de la catégorie")} />
                    </Form.Item>
                </Col>
            </Row>
            <Form.Item
                label={t("Parent Category")}
                name="parent_id"
                tooltip={t("Leave empty for a top-level category. A parent's page also lists its sub-categories' products.")}
            >
                <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder={t("None (top-level)")}
                    options={categories
                        .filter((c) => !excluded.has(c.id))
                        .map((c) => ({ value: c.id, label: c.name }))}
                />
            </Form.Item>
        </>
    );
}
