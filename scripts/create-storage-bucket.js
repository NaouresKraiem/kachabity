/**
 * Script to create the product-images bucket in Supabase
 * Run with: node scripts/create-storage-bucket.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createBucket() {
    try {
        console.log('🚀 Creating product-images bucket...');

        // Check if bucket already exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();

        if (listError) {
            console.error('❌ Error listing buckets:', listError.message);
            return;
        }

        const bucketExists = buckets.some(bucket => bucket.name === 'product-images');

        if (bucketExists) {
            console.log('✅ Bucket "product-images" already exists!');
            return;
        }

        // Create the bucket
        const { data, error } = await supabase.storage.createBucket('product-images', {
            public: true,
            fileSizeLimit: 5242880, // 5MB
        });

        if (error) {
            console.error('❌ Error creating bucket:', error.message);
            console.log('\n💡 Note: You may need a service role key to create buckets programmatically.');
            console.log('   Please create the bucket manually in the Supabase dashboard:');
            console.log(`   https://supabase.com/dashboard/project/fhimhbrhlzhxojtiumhm/storage`);
            return;
        }

        console.log('✅ Bucket "product-images" created successfully!');
        console.log('📦 Bucket details:', data);

        console.log('\n✨ Next steps:');
        console.log('1. Go to Supabase Dashboard → Storage → product-images');
        console.log('2. Click on "Policies" tab');
        console.log('3. Add the following policies:');
        console.log('\n   Policy 1: Public Read Access');
        console.log('   Policy 2: Public Upload (or Authenticated Upload)');
        console.log('   Policy 3: Public Delete (or Authenticated Delete)');

    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
    }
}

createBucket();


