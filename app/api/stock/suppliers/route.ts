import { stockLookupHandlers } from '@/lib/stock-crud';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, DELETE } = stockLookupHandlers('suppliers', ['name', 'email', 'phone', 'notes'], 'Supplier');
