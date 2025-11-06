const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
    console.log('Starting to seed data...');

    try {
        // Hero sections
        console.log('📝 Inserting hero sections...');
        const { error: heroError } = await supabase
            .from('hero_sections')
            .insert([
                {
                    title: 'New Supper Sale',
                    subtitle: 'Serviette de table',
                    cta_label: 'Order Now',
                    cta_href: '#products',
                    image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500',
                    is_active: true,
                    sort_order: 1
                },
                {
                    title: 'New Product HBarnous ROSSINI',
                    subtitle: 'Handcrafted traditional wear',
                    cta_label: 'Buy Now',
                    cta_href: '#products',
                    image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500',
                    is_active: true,
                    sort_order: 2
                }
            ]);

        if (heroError) throw heroError;

        // Categories
        console.log('📂 Inserting categories...');
        const { data: categories, error: categoriesError } = await supabase
            .from('categories')
            .insert([
                { name: 'Kachabia', slug: 'kachabia', image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300', sort_order: 1, is_featured: true },
                { name: 'Milisten Handwoven', slug: 'milisten-handwoven', image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300', sort_order: 2, is_featured: true },
                { name: 'Flint & Kent', slug: 'flint-kent', image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300', sort_order: 3, is_featured: true },
                { name: 'Barnous', slug: 'barnous', image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300', sort_order: 4, is_featured: true },
                { name: 'Coussin et Galette', slug: 'coussin-galette', image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300', sort_order: 5, is_featured: true },
                { name: 'Serviette de table', slug: 'serviette-table', image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300', sort_order: 6, is_featured: true }
            ])
            .select();

        if (categoriesError) throw categoriesError;

        // Products
        console.log('🛍️ Inserting products...');
        const { data: products, error: productsError } = await supabase
            .from('products')
            .insert([
                {
                    title: 'Traditional Kachabia Blue',
                    slug: 'traditional-kachabia-blue',
                    description: 'Handwoven traditional garment in beautiful blue patterns',
                    price_cents: 2500,
                    currency: 'TND',
                    image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400',
                    category_id: categories.find(c => c.slug === 'kachabia').id,
                    rating: 4.3,
                    review_count: 12,
                    stock: 15,
                    is_featured: true
                },
                {
                    title: 'Handwoven Straw Bag',
                    slug: 'handwoven-straw-bag',
                    description: 'Eco-friendly handwoven bag perfect for daily use',
                    price_cents: 1800,
                    currency: 'TND',
                    image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
                    category_id: categories.find(c => c.slug === 'milisten-handwoven').id,
                    rating: 4.5,
                    review_count: 8,
                    stock: 20,
                    is_featured: true
                },
                {
                    title: 'Ceramic Bowl Set',
                    slug: 'ceramic-bowl-set',
                    description: 'Beautiful handmade ceramic bowls for your kitchen',
                    price_cents: 3200,
                    currency: 'TND',
                    image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400',
                    category_id: categories.find(c => c.slug === 'flint-kent').id,
                    rating: 4.7,
                    review_count: 15,
                    stock: 10,
                    is_featured: true
                }
            ])
            .select();

        if (productsError) throw productsError;

        // Reviews
        console.log('⭐ Inserting reviews...');
        const { error: reviewsError } = await supabase
            .from('reviews')
            .insert([
                {
                    product_id: products[0].id,
                    user_name: 'Floyd Miles',
                    rating: 5,
                    comment: 'Beautiful craftsmanship and excellent quality. Highly recommended!'
                },
                {
                    product_id: products[1].id,
                    user_name: 'Ronald Richards',
                    rating: 4,
                    comment: 'Great product, fast delivery. Very satisfied with my purchase.'
                },
                {
                    product_id: products[2].id,
                    user_name: 'Savannah Nguyen',
                    rating: 5,
                    comment: 'Love this bag! Perfect size and very well made.'
                }
            ]);

        if (reviewsError) throw reviewsError;

        console.log('✅ Data seeded successfully!');
        console.log(`📊 Created:`);
        console.log(`   - 2 hero sections`);
        console.log(`   - ${categories.length} categories`);
        console.log(`   - ${products.length} products`);
        console.log(`   - 3 reviews`);

    } catch (error) {
        console.error('❌ Error seeding data:', error.message);
        process.exit(1);
    }
}

seedData();
