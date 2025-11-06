const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = 'https://fhimhbrhlzhxojtiumhm.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createSmallCardsTable() {
    try {
        // First, let's try to insert data directly (table might already exist)
        const { data, error } = await supabase
            .from('small_cards')
            .insert([
                {
                    title: 'Flint & Kent',
                    subtitle: 'Amazing Quality',
                    image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300',
                    bg_color: 'bg-pink-50',
                    is_active: true,
                    sort_order: 1
                },
                {
                    title: 'Milisten Handwoven',
                    subtitle: 'Sale 50%',
                    image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300',
                    bg_color: 'bg-pink-100',
                    is_active: true,
                    sort_order: 2
                },
                {
                    title: 'Coussin et Galette',
                    subtitle: 'Sale off 50%',
                    image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300',
                    bg_color: 'bg-gray-100',
                    is_active: true,
                    sort_order: 3
                },
                {
                    title: 'Clean hands',
                    subtitle: 'Clean bacteria',
                    image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300',
                    bg_color: 'bg-gray-100',
                    is_active: true,
                    sort_order: 4
                },
                {
                    title: 'Nice bag',
                    subtitle: 'Nice style',
                    image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300',
                    bg_color: 'bg-green-100',
                    is_active: true,
                    sort_order: 5
                }
            ]);

        if (error) {
            console.error('Error inserting small cards:', error);
        } else {
            console.log('Small cards inserted successfully!');
            console.log('Data:', data);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

createSmallCardsTable();
