-- Seed data for e-commerce landing page
-- Run this in Supabase SQL Editor after creating the tables

-- Insert hero sections
INSERT INTO public.hero_sections (title, subtitle, cta_label, cta_href, image_url, is_active, sort_order) VALUES
('New Supper Sale', 'Serviette de table', 'Order Now', '#products', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', true, 1),
('New Product HBarnous ROSSINI', 'Handcrafted traditional wear', 'Buy Now', '#products', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500', true, 2);

-- Insert categories
INSERT INTO public.categories (name, slug, image_url, sort_order, is_featured) VALUES
('Kachabia', 'kachabia', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300', 1, true),
('Milisten Handwoven', 'milisten-handwoven', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300', 2, true),
('Flint & Kent', 'flint-kent', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300', 3, true),
('Barnous', 'barnous', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300', 4, true),
('Coussin et Galette', 'coussin-galette', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300', 5, true),
('Serviette de table', 'serviette-table', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300', 6, true);

-- Insert products
INSERT INTO public.products (title, slug, description, price_cents, currency, image_url, category_id, rating, review_count, stock, is_featured) VALUES
('Traditional Kachabia Blue', 'traditional-kachabia-blue', 'Handwoven traditional garment in beautiful blue patterns', 2500, 'TND', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400', (SELECT id FROM public.categories WHERE slug = 'kachabia'), 4.3, 12, 15, true),
('Handwoven Straw Bag', 'handwoven-straw-bag', 'Eco-friendly handwoven bag perfect for daily use', 1800, 'TND', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', (SELECT id FROM public.categories WHERE slug = 'milisten-handwoven'), 4.5, 8, 20, true),
('Ceramic Bowl Set', 'ceramic-bowl-set', 'Beautiful handmade ceramic bowls for your kitchen', 3200, 'TND', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', (SELECT id FROM public.categories WHERE slug = 'flint-kent'), 4.7, 15, 10, true),
('Cream Barnous', 'cream-barnous', 'Elegant cream-colored traditional wear', 2800, 'TND', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400', (SELECT id FROM public.categories WHERE slug = 'barnous'), 4.2, 6, 12, true),
('Patterned Cushion', 'patterned-cushion', 'Decorative cushion with traditional patterns', 1200, 'TND', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', (SELECT id FROM public.categories WHERE slug = 'coussin-galette'), 4.0, 4, 25, true),
('Table Napkins Set', 'table-napkins-set', 'Elegant table napkins with gold accents', 800, 'TND', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', (SELECT id FROM public.categories WHERE slug = 'serviette-table'), 4.4, 9, 30, true),
('Leather Handbag', 'leather-handbag', 'Premium leather handbag with traditional design', 4500, 'TND', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', (SELECT id FROM public.categories WHERE slug = 'milisten-handwoven'), 4.6, 11, 8, true),
('Wooden Home Decor', 'wooden-home-decor', 'Handcrafted wooden home accessories', 2200, 'TND', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', (SELECT id FROM public.categories WHERE slug = 'flint-kent'), 4.3, 7, 18, true);

-- Insert product images (additional images for products)
INSERT INTO public.product_images (product_id, image_url, sort_order) VALUES
((SELECT id FROM public.products WHERE slug = 'traditional-kachabia-blue'), 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400', 1),
((SELECT id FROM public.products WHERE slug = 'traditional-kachabia-blue'), 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400', 2),
((SELECT id FROM public.products WHERE slug = 'handwoven-straw-bag'), 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', 1),
((SELECT id FROM public.products WHERE slug = 'ceramic-bowl-set'), 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', 1);

-- Insert promotions
INSERT INTO public.promotions (title, subtitle, badge_text, discount_percent, image_url, starts_at, ends_at, active) VALUES
('Sale Up To 50%', 'Limited time offer on selected items', '50% OFF', 50, 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600', NOW(), NOW() + INTERVAL '30 days', true),
('New Arrivals', 'Fresh handmade products', 'NEW', 0, 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600', NOW(), NOW() + INTERVAL '60 days', true);

-- Insert reviews
INSERT INTO public.reviews (product_id, user_name, rating, comment) VALUES
((SELECT id FROM public.products WHERE slug = 'traditional-kachabia-blue'), 'Floyd Miles', 5, 'Beautiful craftsmanship and excellent quality. Highly recommended!'),
((SELECT id FROM public.products WHERE slug = 'traditional-kachabia-blue'), 'Ronald Richards', 4, 'Great product, fast delivery. Very satisfied with my purchase.'),
((SELECT id FROM public.products WHERE slug = 'handwoven-straw-bag'), 'Savannah Nguyen', 5, 'Love this bag! Perfect size and very well made.'),
((SELECT id FROM public.products WHERE slug = 'ceramic-bowl-set'), 'Floyd Miles', 5, 'Stunning ceramic work. These bowls are now my favorites in the kitchen.'),
((SELECT id FROM public.products WHERE slug = 'cream-barnous'), 'Ronald Richards', 4, 'Traditional design with modern comfort. Great value for money.'),
((SELECT id FROM public.products WHERE slug = 'patterned-cushion'), 'Savannah Nguyen', 4, 'Beautiful patterns and soft material. Perfect for my living room.'),
((SELECT id FROM public.products WHERE slug = 'table-napkins-set'), 'Floyd Miles', 5, 'Elegant and practical. The gold accents are beautiful.'),
((SELECT id FROM public.products WHERE slug = 'leather-handbag'), 'Ronald Richards', 5, 'Premium quality leather. This bag will last for years.'),
((SELECT id FROM public.products WHERE slug = 'wooden-home-decor'), 'Savannah Nguyen', 4, 'Handcrafted with attention to detail. Beautiful addition to my home.');
