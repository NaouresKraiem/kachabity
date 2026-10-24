import supabase from '@/lib/supabase-admin';
import { must, ok, params, route } from '@/lib/erp/api';

export const dynamic = 'force-dynamic';

/** Purchase prices by item and supplier (quotes and orders): last, lowest and average price. */
export const GET = route('purchasing-prices', async (request) => {
    const q = params(request);
    return ok(must(await supabase.rpc('purchase_price_comparison', {
        p_variant_id: q.get('variant_id'),
        p_material_id: q.get('material_id'),
    })));
});
