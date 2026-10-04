"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Card, Empty, InputNumber, Select, Space, Switch, Tag, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { searchByText } from "@/components/admin/select-search";
import { useAdminT } from "@/lib/admin-i18n";
import {
    DEFAULT_LANDING_CONFIG,
    MAX_LIST_COUNT,
    type HomeSectionKey,
    type LandingConfig,
    type LandingSection,
    type ListSection,
} from "@/lib/landing-config";

const { Title, Text, Paragraph } = Typography;

interface ProductSummary {
    id: string;
    name: string;
    status: string;
    deleted_at: string | null;
    created_at: string;
    product_images?: { image_url: string; is_main: boolean; position: number }[];
}

interface CategorySummary {
    id: string;
    name: string;
    image_url: string | null;
    parent_id: string | null;
}

const SECTION_LABELS: Record<HomeSectionKey, string> = {
    showcase: "Header showcase",
    new_arrivals: "New arrivals",
    services: "Service highlights",
    categories: "Featured categories",
    top_products: "Top products",
    spotlight: "Collection spotlight",
    promo_products: "Promotions",
    sale_banners: "Sale Banners",
    reels: "Video Reels",
    reviews: "Customer reviews",
    how_to_order: "How to order",
    faq: "FAQ",
};

interface PickerInfo {
    key: LandingSection;
    title: string;
    help: string;
}

const PICKERS: PickerInfo[] = [
    { key: "new_arrivals", title: "New arrivals", help: "Pinned products come first, in this order, then the newest products." },
    { key: "top_products", title: "Top products", help: "Pinned products come first, then the best sellers." },
    { key: "promo_products", title: "Promotions", help: "Pinned products come first, then the latest discounts. A product only shows here while it has an active discount." },
    { key: "spotlight", title: "Collection spotlight", help: "One category with its products. Pinned products come first, then the category's best sellers." },
    { key: "showcase", title: "Header showcase", help: "The pieces in the header photo. Pick 3. With none picked, the newest products are shown." },
    { key: "ring", title: "3D ring", help: "Extra pieces turning in the header ring, after the showcase ones (16 cards in all)." },
];

const isListSection = (key: LandingSection): key is ListSection =>
    key === "new_arrivals" || key === "top_products" || key === "promo_products" || key === "spotlight";

function productImage(product: ProductSummary): string | null {
    const images = product.product_images ?? [];
    return (images.find((img) => img.is_main) ?? [...images].sort((a, b) => a.position - b.position)[0])?.image_url ?? null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function moveItem<T>(items: T[], index: number, delta: number): T[] {
    const target = index + delta;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

interface OrderedRow {
    id: string;
    name: string;
    image: string | null;
    warning?: string | null;
}

// A numbered list with move up / move down / remove buttons.
function OrderedList({ rows, onChange, emptyText }: { rows: OrderedRow[]; onChange: (ids: string[]) => void; emptyText: string }) {
    const { t } = useAdminT();
    const ids = rows.map((row) => row.id);
    if (rows.length === 0) return <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    return (
        <Space orientation="vertical" style={{ width: "100%" }}>
            {rows.map((row, index) => (
                <div
                    key={row.id}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, border: "1px solid #f0f0f0", borderRadius: 8 }}
                >
                    <Text strong style={{ width: 24, textAlign: "center" }}>{index + 1}</Text>
                    {row.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                        <img src={row.image} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
                    ) : (
                        <div style={{ width: 48, height: 48, background: "#f5f5f5", borderRadius: 6 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text ellipsis>{row.name}</Text>
                        {row.warning && (
                            <div>
                                <Tag color="orange">{row.warning}</Tag>
                            </div>
                        )}
                    </div>
                    <Space>
                        <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => onChange(moveItem(ids, index, -1))} aria-label={t("Move up")} />
                        <Button size="small" icon={<ArrowDownOutlined />} disabled={index === rows.length - 1} onClick={() => onChange(moveItem(ids, index, 1))} aria-label={t("Move down")} />
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onChange(ids.filter((id) => id !== row.id))} aria-label={t("Remove")} />
                    </Space>
                </div>
            ))}
        </Space>
    );
}

function SaveButton({ dirty, loading, onClick }: { dirty: boolean; loading: boolean; onClick: () => void }) {
    const { t } = useAdminT();
    return (
        <Button type="primary" icon={<SaveOutlined />} disabled={!dirty} loading={loading} onClick={onClick}>
            {t("Save")}
        </Button>
    );
}

type Picks = Record<LandingSection, string[]>;
const EMPTY_PICKS: Picks = { new_arrivals: [], showcase: [], ring: [], top_products: [], promo_products: [], spotlight: [] };

export default function LandingPage() {
    const { t } = useAdminT();
    const [products, setProducts] = useState<ProductSummary[]>([]);
    const [categories, setCategories] = useState<CategorySummary[]>([]);
    const [savedPicks, setSavedPicks] = useState<Picks>(EMPTY_PICKS);
    const [picks, setPicks] = useState<Picks>(EMPTY_PICKS);
    const [savedConfig, setSavedConfig] = useState<LandingConfig>(DEFAULT_LANDING_CONFIG);
    const [config, setConfig] = useState<LandingConfig>(DEFAULT_LANDING_CONFIG);
    const [savedFeatured, setSavedFeatured] = useState<string[]>([]);
    const [featured, setFeatured] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    // Saves send whole lists and settings, so saving over a failed load would wipe them.
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const responses = await Promise.all([
                    fetch("/api/landing"),
                    fetch("/api/products?admin=true&view=summary"),
                    fetch("/api/categories"),
                ]);
                const [landing, productList, categoryList] = await Promise.all(responses.map((r) => r.json()));
                if (!landing.success || !productList.success || !categoryList.success) {
                    throw new Error(landing.error || productList.error || categoryList.error);
                }
                setProducts(productList.data);
                setCategories(categoryList.data);
                setSavedPicks({ ...EMPTY_PICKS, ...landing.data.sections });
                setPicks({ ...EMPTY_PICKS, ...landing.data.sections });
                setSavedConfig(landing.data.config);
                setConfig(landing.data.config);
                setSavedFeatured(landing.data.featuredCategories);
                setFeatured(landing.data.featuredCategories);
            } catch (error) {
                console.error("Error loading landing page settings:", error);
                setLoadFailed(true);
                message.error(t("Failed to load the landing page settings"));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
    const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

    const save = async (key: string, body: Record<string, unknown>, onSaved: () => void) => {
        if (loadFailed) {
            message.error(t("The current settings didn't load. Reload the page before saving."));
            return;
        }
        setSaving(key);
        try {
            const response = await fetch("/api/landing", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            onSaved();
            message.success(t("Saved. The home page is updated."));
        } catch (error) {
            console.error("Error saving the landing page:", error);
            message.error(t("Failed to save"));
        } finally {
            setSaving(null);
        }
    };

    // Layout ----------------------------------------------------------------
    const layoutDirty = !same(config.layout, savedConfig.layout);
    const saveLayout = () => {
        const next = { ...savedConfig, layout: config.layout };
        save("layout", { config: next }, () => setSavedConfig(next));
    };

    // Product lists: each card saves its picks with its own settings only.
    const pickerConfig = (key: LandingSection): LandingConfig => ({
        ...savedConfig,
        lists: isListSection(key) ? { ...savedConfig.lists, [key]: config.lists[key] } : savedConfig.lists,
        spotlightCategoryId: key === "spotlight" ? config.spotlightCategoryId : savedConfig.spotlightCategoryId,
    });
    const pickerDirty = (key: LandingSection) =>
        !same(picks[key], savedPicks[key]) || !same(pickerConfig(key), savedConfig);
    const savePicker = (key: LandingSection) => {
        const nextConfig = pickerConfig(key);
        save(key, { section: key, product_ids: picks[key], config: nextConfig }, () => {
            setSavedPicks((current) => ({ ...current, [key]: picks[key] }));
            setSavedConfig(nextConfig);
        });
    };
    const setList = (key: ListSection, change: Partial<LandingConfig["lists"][ListSection]>) =>
        setConfig((current) => ({ ...current, lists: { ...current.lists, [key]: { ...current.lists[key], ...change } } }));

    const productRows = (ids: string[]): OrderedRow[] => ids.map((id) => {
        const product = productsById.get(id);
        const image = product ? productImage(product) : null;
        const hidden = !product || product.deleted_at || product.status !== "active" || !image;
        return {
            id,
            name: product?.name ?? t("Unknown product"),
            image,
            warning: hidden ? t("Not shown: inactive, deleted or without a photo") : null,
        };
    });

    const productOptions = (exclude: string[]) => products
        .filter((p) => !p.deleted_at && !exclude.includes(p.id))
        .map((p) => ({
            value: p.id,
            searchtext: p.name,
            label: (
                <span>
                    {p.name}{" "}
                    <Text type="secondary" style={{ fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString()}</Text>
                </span>
            ),
        }));

    // Featured categories ---------------------------------------------------
    const categoryName = (category: CategorySummary) => {
        const parent = category.parent_id ? categoriesById.get(category.parent_id) : undefined;
        return parent ? `${parent.name} › ${category.name}` : category.name;
    };
    const categoryOptions = (exclude: string[]) => categories
        .filter((c) => !exclude.includes(c.id))
        .map((c) => ({ value: c.id, label: categoryName(c), searchtext: categoryName(c) }));
    const featuredDirty = !same(featured, savedFeatured);

    const sectionCard = (key: string, title: string, extra: ReactNode, children: ReactNode) => (
        <Card key={key} loading={loading} title={title} extra={extra}>
            {children}
        </Card>
    );

    return (
        <div style={{ padding: 24 }}>
            <Title level={2} style={{ marginTop: 0 }}>{t("Landing page")}</Title>
            <Paragraph type="secondary">
                {t("Choose which products the home page shows and in what order. Changes are live as soon as you save.")}
            </Paragraph>

            <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                {sectionCard(
                    "layout",
                    t("Page layout"),
                    <SaveButton dirty={layoutDirty} loading={saving === "layout"} onClick={saveLayout} />,
                    <>
                        <Paragraph type="secondary">{t("The order of the sections on the home page. Switch a section off to hide it.")}</Paragraph>
                        <Space orientation="vertical" style={{ width: "100%" }}>
                            {config.layout.map((section, index) => (
                                <div
                                    key={section.key}
                                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 8px", border: "1px solid #f0f0f0", borderRadius: 8 }}
                                >
                                    <Text strong style={{ width: 24, textAlign: "center" }}>{index + 1}</Text>
                                    <Text style={{ flex: 1 }} type={section.visible ? undefined : "secondary"}>{t(SECTION_LABELS[section.key])}</Text>
                                    <Switch
                                        size="small"
                                        checked={section.visible}
                                        aria-label={t("Visible")}
                                        onChange={(visible) => setConfig((current) => ({
                                            ...current,
                                            layout: current.layout.map((s) => (s.key === section.key ? { ...s, visible } : s)),
                                        }))}
                                    />
                                    <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} aria-label={t("Move up")}
                                        onClick={() => setConfig((current) => ({ ...current, layout: moveItem(current.layout, index, -1) }))} />
                                    <Button size="small" icon={<ArrowDownOutlined />} disabled={index === config.layout.length - 1} aria-label={t("Move down")}
                                        onClick={() => setConfig((current) => ({ ...current, layout: moveItem(current.layout, index, 1) }))} />
                                </div>
                            ))}
                        </Space>
                    </>
                )}

                {PICKERS.map((picker) => {
                    const ids = picks[picker.key];
                    return sectionCard(
                        picker.key,
                        t(picker.title),
                        <SaveButton dirty={pickerDirty(picker.key)} loading={saving === picker.key} onClick={() => savePicker(picker.key)} />,
                        <>
                            <Paragraph type="secondary">{t(picker.help)}</Paragraph>

                            {picker.key === "spotlight" && (
                                <Space wrap align="center" style={{ marginBottom: 16 }}>
                                    <Text>{t("Category")}</Text>
                                    <Select
                                        showSearch
                                        allowClear
                                        style={{ width: 280, maxWidth: "100%" }}
                                        placeholder={t("Automatic (the category with the most products)")}
                                        value={config.spotlightCategoryId ?? undefined}
                                        options={categoryOptions([])}
                                        filterOption={searchByText}
                                        onChange={(id?: string) => setConfig((current) => ({ ...current, spotlightCategoryId: id ?? null }))}
                                    />
                                </Space>
                            )}

                            {isListSection(picker.key) && (
                                <Space wrap align="center" style={{ marginBottom: 16 }}>
                                    <Text>{t("Products shown")}</Text>
                                    <InputNumber
                                        min={1}
                                        max={MAX_LIST_COUNT}
                                        value={config.lists[picker.key].count}
                                        onChange={(value) => setList(picker.key as ListSection, { count: Number(value) || 1 })}
                                    />
                                    <Switch
                                        checked={config.lists[picker.key].autofill}
                                        onChange={(autofill) => setList(picker.key as ListSection, { autofill })}
                                    />
                                    <Text>{t("Fill the rest automatically")}</Text>
                                </Space>
                            )}

                            <Select
                                showSearch
                                value={null}
                                placeholder={t("Add a product (newest first)")}
                                options={productOptions(ids)}
                                filterOption={searchByText}
                                onChange={(id: string) => setPicks((current) => ({ ...current, [picker.key]: [...ids, id] }))}
                                style={{ width: "100%", marginBottom: 16 }}
                            />

                            <OrderedList
                                rows={productRows(ids)}
                                emptyText={t("No products picked")}
                                onChange={(next) => setPicks((current) => ({ ...current, [picker.key]: next }))}
                            />
                        </>
                    );
                })}

                {sectionCard(
                    "featured",
                    t("Featured categories"),
                    <SaveButton
                        dirty={featuredDirty}
                        loading={saving === "featured"}
                        onClick={() => save("featured", { featured_category_ids: featured }, () => setSavedFeatured(featured))}
                    />,
                    <>
                        <Paragraph type="secondary">{t("The categories shown on the home page, in this order.")}</Paragraph>
                        <Select
                            showSearch
                            value={null}
                            placeholder={t("Add a category")}
                            options={categoryOptions(featured)}
                            filterOption={searchByText}
                            onChange={(id: string) => setFeatured((current) => [...current, id])}
                            style={{ width: "100%", marginBottom: 16 }}
                        />
                        <OrderedList
                            rows={featured.map((id) => {
                                const category = categoriesById.get(id);
                                return {
                                    id,
                                    name: category ? categoryName(category) : t("Unknown category"),
                                    image: category?.image_url ?? null,
                                    warning: category && !category.image_url ? t("No image") : null,
                                };
                            })}
                            emptyText={t("No categories picked")}
                            onChange={setFeatured}
                        />
                    </>
                )}
            </Space>
        </div>
    );
}
