const serverUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

type SchemaObject = Record<string, unknown>;

const arrayResponse = (schemaRef: string, description: string): SchemaObject => ({
    description,
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                        type: 'array',
                        items: { $ref: schemaRef },
                    },
                    error: { type: 'string', nullable: true },
                },
            },
        },
    },
});

const objectResponse = (schemaRef: string, description: string): SchemaObject => ({
    description,
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: schemaRef },
                    error: { type: 'string', nullable: true },
                },
            },
        },
    },
});

const messageResponse = (description: string): SchemaObject => ({
    description,
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    error: { type: 'string', nullable: true },
                },
            },
        },
    },
});

const errorResponse = (_status: number, message = 'Unexpected error'): SchemaObject => ({
    description: message,
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                },
            },
        },
    },
});

export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Kachabity API',
        description: 'REST API powering the Kachabity storefront and admin dashboard.',
        version: '1.0.0',
        contact: {
            name: 'Kachabity Dev Team',
            url: serverUrl,
        },
    },
    servers: [
        { url: serverUrl, description: 'Current deployment' },
        { url: 'http://localhost:3000', description: 'Local development' },
    ],
    tags: [
        { name: 'Catalog', description: 'Products, categories, sizes, colors' },
        { name: 'Inventory', description: 'Variants and product images' },
        { name: 'Marketing', description: 'Newsletter and contact forms' },
        { name: 'Operations', description: 'Orders, uploads, and automations' },
    ],
    paths: {
        '/api/products': {
            get: {
                tags: ['Catalog'],
                summary: 'List active products',
                responses: {
                    200: arrayResponse('#/components/schemas/Product', 'Products fetched successfully'),
                    500: errorResponse(500, 'Failed to fetch products'),
                },
            },
            post: {
                tags: ['Catalog'],
                summary: 'Create a product with optional variants and images',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ProductInput' },
                        },
                    },
                },
                responses: {
                    201: objectResponse('#/components/schemas/Product', 'Product created'),
                    500: errorResponse(500, 'Failed to create product'),
                },
            },
            put: {
                tags: ['Catalog'],
                summary: 'Update a product',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                allOf: [
                                    { $ref: '#/components/schemas/ProductInput' },
                                    {
                                        type: 'object',
                                        required: ['id'],
                                        properties: {
                                            id: { type: 'string', description: 'Product ID' },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    200: objectResponse('#/components/schemas/Product', 'Product updated'),
                    400: errorResponse(400, 'Product ID missing'),
                    500: errorResponse(500, 'Failed to update product'),
                },
            },
            delete: {
                tags: ['Catalog'],
                summary: 'Delete or soft-delete a product',
                parameters: [
                    {
                        name: 'id',
                        in: 'query',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Product ID to delete',
                    },
                ],
                responses: {
                    200: messageResponse('Product deleted'),
                    400: errorResponse(400, 'Product ID missing'),
                    500: errorResponse(500, 'Failed to delete product'),
                },
            },
        },
        '/api/categories': {
            get: {
                tags: ['Catalog'],
                summary: 'List categories',
                responses: {
                    200: arrayResponse('#/components/schemas/Category', 'Categories fetched'),
                    500: errorResponse(500, 'Failed to fetch categories'),
                },
            },
            post: {
                tags: ['Catalog'],
                summary: 'Create category',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CategoryInput' },
                        },
                    },
                },
                responses: {
                    201: objectResponse('#/components/schemas/Category', 'Category created'),
                    400: errorResponse(400, 'Validation error'),
                    500: errorResponse(500, 'Failed to create category'),
                },
            },
            put: {
                tags: ['Catalog'],
                summary: 'Update category',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                allOf: [
                                    { $ref: '#/components/schemas/CategoryInput' },
                                    {
                                        type: 'object',
                                        required: ['id'],
                                        properties: { id: { type: 'string' } },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    200: objectResponse('#/components/schemas/Category', 'Category updated'),
                    400: errorResponse(400, 'Category ID missing'),
                    500: errorResponse(500, 'Failed to update category'),
                },
            },
            delete: {
                tags: ['Catalog'],
                summary: 'Delete category',
                parameters: [
                    { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: messageResponse('Category deleted'),
                    400: errorResponse(400, 'Category ID missing'),
                    500: errorResponse(500, 'Failed to delete category'),
                },
            },
        },
        '/api/colors': {
            get: {
                tags: ['Catalog'],
                summary: 'List colors',
                responses: {
                    200: arrayResponse('#/components/schemas/Color', 'Colors fetched'),
                    500: errorResponse(500, 'Failed to fetch colors'),
                },
            },
            post: {
                tags: ['Catalog'],
                summary: 'Create color',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ColorInput' },
                        },
                    },
                },
                responses: {
                    201: objectResponse('#/components/schemas/Color', 'Color created'),
                    400: errorResponse(400, 'Validation error'),
                    500: errorResponse(500, 'Failed to create color'),
                },
            },
            put: {
                tags: ['Catalog'],
                summary: 'Update color',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                allOf: [
                                    { $ref: '#/components/schemas/ColorInput' },
                                    {
                                        type: 'object',
                                        required: ['id'],
                                        properties: { id: { type: 'string' } },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    200: objectResponse('#/components/schemas/Color', 'Color updated'),
                    400: errorResponse(400, 'Color ID missing'),
                    500: errorResponse(500, 'Failed to update color'),
                },
            },
            delete: {
                tags: ['Catalog'],
                summary: 'Delete color',
                parameters: [
                    { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: messageResponse('Color deleted'),
                    400: errorResponse(400, 'Color ID missing'),
                    500: errorResponse(500, 'Failed to delete color'),
                },
            },
        },
        '/api/sizes': {
            get: {
                tags: ['Catalog'],
                summary: 'List sizes',
                responses: {
                    200: arrayResponse('#/components/schemas/Size', 'Sizes fetched'),
                    500: errorResponse(500, 'Failed to fetch sizes'),
                },
            },
            post: {
                tags: ['Catalog'],
                summary: 'Create size',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/SizeInput' },
                        },
                    },
                },
                responses: {
                    201: objectResponse('#/components/schemas/Size', 'Size created'),
                    400: errorResponse(400, 'Validation error'),
                    500: errorResponse(500, 'Failed to create size'),
                },
            },
            put: {
                tags: ['Catalog'],
                summary: 'Update size',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                allOf: [
                                    { $ref: '#/components/schemas/SizeInput' },
                                    {
                                        type: 'object',
                                        required: ['id'],
                                        properties: { id: { type: 'string' } },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    200: objectResponse('#/components/schemas/Size', 'Size updated'),
                    400: errorResponse(400, 'Size ID missing'),
                    500: errorResponse(500, 'Failed to update size'),
                },
            },
            delete: {
                tags: ['Catalog'],
                summary: 'Delete size',
                parameters: [
                    { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: messageResponse('Size deleted'),
                    400: errorResponse(400, 'Size ID missing'),
                    500: errorResponse(500, 'Failed to delete size'),
                },
            },
        },
        '/api/variants': {
            get: {
                tags: ['Inventory'],
                summary: 'List variants for a product',
                parameters: [
                    {
                        name: 'product_id',
                        in: 'query',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Product ID to filter variants',
                    },
                ],
                responses: {
                    200: arrayResponse('#/components/schemas/Variant', 'Variants fetched'),
                    400: errorResponse(400, 'Product ID missing'),
                    500: errorResponse(500, 'Failed to fetch variants'),
                },
            },
            post: {
                tags: ['Inventory'],
                summary: 'Create variant',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/VariantInput' },
                        },
                    },
                },
                responses: {
                    201: objectResponse('#/components/schemas/Variant', 'Variant created'),
                    400: errorResponse(400, 'Validation error'),
                    500: errorResponse(500, 'Failed to create variant'),
                },
            },
            put: {
                tags: ['Inventory'],
                summary: 'Update variant',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                allOf: [
                                    { $ref: '#/components/schemas/VariantInput' },
                                    {
                                        type: 'object',
                                        required: ['id'],
                                        properties: { id: { type: 'string' } },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    200: objectResponse('#/components/schemas/Variant', 'Variant updated'),
                    400: errorResponse(400, 'Variant ID missing'),
                    500: errorResponse(500, 'Failed to update variant'),
                },
            },
            delete: {
                tags: ['Inventory'],
                summary: 'Delete variant',
                parameters: [
                    { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: messageResponse('Variant deleted'),
                    400: errorResponse(400, 'Variant ID missing'),
                    500: errorResponse(500, 'Failed to delete variant'),
                },
            },
        },
        '/api/product-images': {
            get: {
                tags: ['Inventory'],
                summary: 'List product images',
                parameters: [
                    { name: 'product_id', in: 'query', required: false, schema: { type: 'string' } },
                    { name: 'variant_id', in: 'query', required: false, schema: { type: 'string' } },
                ],
                responses: {
                    200: arrayResponse('#/components/schemas/ProductImage', 'Images fetched'),
                    500: errorResponse(500, 'Failed to fetch images'),
                },
            },
            post: {
                tags: ['Inventory'],
                summary: 'Create product image',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ProductImageInput' },
                        },
                    },
                },
                responses: {
                    201: objectResponse('#/components/schemas/ProductImage', 'Image created'),
                    400: errorResponse(400, 'Validation error'),
                    500: errorResponse(500, 'Failed to create image'),
                },
            },
            put: {
                tags: ['Inventory'],
                summary: 'Update product image metadata',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                allOf: [
                                    { $ref: '#/components/schemas/ProductImageUpdate' },
                                    {
                                        type: 'object',
                                        required: ['id'],
                                        properties: { id: { type: 'string' } },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    200: objectResponse('#/components/schemas/ProductImage', 'Image updated'),
                    400: errorResponse(400, 'Image ID missing'),
                    500: errorResponse(500, 'Failed to update image'),
                },
            },
            delete: {
                tags: ['Inventory'],
                summary: 'Delete product image',
                parameters: [
                    { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: messageResponse('Image deleted'),
                    400: errorResponse(400, 'Image ID missing'),
                    500: errorResponse(500, 'Failed to delete image'),
                },
            },
        },
        '/api/upload/image': {
            post: {
                tags: ['Operations'],
                summary: 'Upload image to Supabase storage',
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['file'],
                                properties: {
                                    file: {
                                        type: 'string',
                                        format: 'binary',
                                        description: 'JPEG, PNG, WebP, or GIF (max 5MB)',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Upload result',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        url: { type: 'string', format: 'uri' },
                                        fileName: { type: 'string' },
                                        error: { type: 'string', nullable: true },
                                    },
                                },
                            },
                        },
                    },
                    400: errorResponse(400, 'Validation error'),
                    500: errorResponse(500, 'Upload failed'),
                },
            },
            delete: {
                tags: ['Operations'],
                summary: 'Remove image from storage',
                parameters: [
                    {
                        name: 'fileName',
                        in: 'query',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: messageResponse('Image removed'),
                    400: errorResponse(400, 'File name missing'),
                    500: errorResponse(500, 'Failed to remove image'),
                },
            },
        },
        '/api/contact': {
            post: {
                tags: ['Marketing'],
                summary: 'Send contact form email',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ContactRequest' },
                        },
                    },
                },
                responses: {
                    200: messageResponse('Email sent'),
                    400: errorResponse(400, 'Validation error'),
                    500: errorResponse(500, 'Email service not configured or failed'),
                },
            },
        },
        '/api/newsletter/subscribe': {
            post: {
                tags: ['Marketing'],
                summary: 'Subscribe email to newsletter',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/NewsletterSubscribeRequest' },
                        },
                    },
                },
                responses: {
                    200: messageResponse('Subscription accepted'),
                    400: errorResponse(400, 'Invalid email address'),
                    500: errorResponse(500, 'Subscription failed'),
                },
            },
        },
        '/api/newsletter/unsubscribe': {
            get: {
                tags: ['Marketing'],
                summary: 'Unsubscribe email via magic link',
                parameters: [
                    {
                        name: 'email',
                        in: 'query',
                        required: true,
                        schema: { type: 'string', format: 'email' },
                    },
                ],
                responses: {
                    200: {
                        description: 'HTML confirmation page',
                        content: { 'text/html': { schema: { type: 'string' } } },
                    },
                    400: errorResponse(400, 'Email missing'),
                    500: errorResponse(500, 'Failed to unsubscribe'),
                },
            },
        },
        '/api/send-order-email': {
            post: {
                tags: ['Operations'],
                summary: 'Send order confirmation email',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/SendOrderEmailRequest' },
                        },
                    },
                },
                responses: {
                    200: messageResponse('Email dispatched'),
                    400: errorResponse(400, 'Missing payload'),
                    500: errorResponse(500, 'Failed to send email'),
                },
            },
        },
        '/api/cart/send-recovery-emails': {
            post: {
                tags: ['Operations'],
                summary: 'Trigger abandoned cart campaign',
                responses: {
                    200: {
                        description: 'Batch result',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        sent: { type: 'integer' },
                                        failed: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                    500: errorResponse(500, 'Failed to send recovery emails'),
                },
            },
        },
    },
    components: {
        schemas: {
            Category: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    sort_order: { type: 'integer' },
                    is_featured: { type: 'boolean' },
                },
            },
            CategoryInput: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    sort_order: { type: 'integer', default: 0 },
                    is_featured: { type: 'boolean', default: false },
                },
            },
            Color: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    hex_code: { type: 'string' },
                    rgb_code: { type: 'string' },
                    display_name: { type: 'string' },
                    sort_order: { type: 'integer' },
                    description: { type: 'string' },
                },
            },
            ColorInput: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    hex_code: { type: 'string', nullable: true },
                    rgb_code: { type: 'string', nullable: true },
                    display_name: { type: 'string', nullable: true },
                    sort_order: { type: 'integer', default: 0 },
                    description: { type: 'string', nullable: true },
                },
            },
            Size: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    display_name: { type: 'string' },
                    sort_order: { type: 'integer' },
                    description: { type: 'string' },
                },
            },
            SizeInput: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    display_name: { type: 'string', nullable: true },
                    sort_order: { type: 'integer', default: 0 },
                    description: { type: 'string', nullable: true },
                },
            },
            Variant: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    product_id: { type: 'string' },
                    size_id: { type: 'string', nullable: true },
                    color_id: { type: 'string', nullable: true },
                    sku: { type: 'string', nullable: true },
                    price: { type: 'number', nullable: true },
                    stock: { type: 'integer' },
                    is_available: { type: 'boolean' },
                },
            },
            VariantInput: {
                type: 'object',
                required: ['product_id'],
                properties: {
                    product_id: { type: 'string' },
                    size_id: { type: 'string', nullable: true },
                    color_id: { type: 'string', nullable: true },
                    sku: { type: 'string', nullable: true },
                    price: { type: 'number', nullable: true },
                    price_cents: { type: 'number', nullable: true },
                    stock: { type: 'integer', default: 0 },
                    is_available: { type: 'boolean', default: true },
                },
            },
            ProductImage: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    product_id: { type: 'string' },
                    variant_id: { type: 'string', nullable: true },
                    image_url: { type: 'string' },
                    alt_text: { type: 'string', nullable: true },
                    is_main: { type: 'boolean' },
                    position: { type: 'integer' },
                },
            },
            ProductImageInput: {
                type: 'object',
                required: ['product_id', 'image_url'],
                properties: {
                    product_id: { type: 'string' },
                    variant_id: { type: 'string', nullable: true },
                    image_url: { type: 'string' },
                    alt_text: { type: 'string', nullable: true },
                    is_main: { type: 'boolean', default: false },
                    position: { type: 'integer', nullable: true },
                },
            },
            ProductImageUpdate: {
                type: 'object',
                properties: {
                    image_url: { type: 'string', nullable: true },
                    alt_text: { type: 'string', nullable: true },
                    is_main: { type: 'boolean', nullable: true },
                    position: { type: 'integer', nullable: true },
                },
            },
            Product: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    category_id: { type: 'string', nullable: true },
                    base_price: { type: 'number' },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                    variants: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Variant' },
                    },
                    images: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ProductImage' },
                    },
                },
            },
            ProductInput: {
                type: 'object',
                required: ['name', 'base_price'],
                properties: {
                    name: { type: 'string' },
                    slug: { type: 'string', nullable: true },
                    description: { type: 'string', nullable: true },
                    category_id: { type: 'string', nullable: true },
                    base_price: { type: 'number' },
                    status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
                    variants: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/VariantInput' },
                    },
                    images: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ProductImageInput' },
                    },
                },
            },
            ContactRequest: {
                type: 'object',
                required: ['firstName', 'lastName', 'email', 'message'],
                properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string', nullable: true },
                    message: { type: 'string' },
                    locale: { type: 'string', enum: ['en', 'fr', 'ar'], nullable: true },
                },
            },
            NewsletterSubscribeRequest: {
                type: 'object',
                required: ['email'],
                properties: {
                    email: { type: 'string', format: 'email' },
                },
            },
            SendOrderEmailRequest: {
                type: 'object',
                required: ['order', 'orderItems', 'customerName'],
                properties: {
                    order: { type: 'object' },
                    orderItems: { type: 'array', items: { type: 'object' } },
                    customerName: { type: 'string' },
                },
            },
        },
    },
} satisfies Record<string, unknown>;

export type OpenApiSpec = typeof openApiSpec;

