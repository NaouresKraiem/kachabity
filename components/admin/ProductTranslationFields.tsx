"use client";

import { Col, Form, Input, Row } from "antd";
import { useAdminT } from "@/lib/admin-i18n";

const { TextArea } = Input;

/**
 * Arabic and French name/description, shared by the create and edit product forms.
 * The main Name/Description fields hold the English (default) text.
 */
export default function ProductTranslationFields() {
    const { t } = useAdminT();
    return (
        <>
            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item label={t("Name (Arabic)")} name="name_ar">
                        <Input dir="rtl" placeholder="اسم المنتج" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item label={t("Name (French)")} name="name_fr">
                        <Input placeholder={t("Nom du produit")} />
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item label={t("Description (Arabic)")} name="description_ar">
                        <TextArea dir="rtl" rows={4} placeholder="وصف المنتج" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item label={t("Description (French)")} name="description_fr">
                        <TextArea rows={4} placeholder={t("Description du produit")} />
                    </Form.Item>
                </Col>
            </Row>
        </>
    );
}
