import { stockLookupHandlers } from '@/lib/stock-crud';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, DELETE } = stockLookupHandlers('suppliers', ['name', 'email', 'phone', 'notes', 'contact_name', 'address', 'tax_id', 'bank_details', 'payment_terms_days', 'kind'], 'Supplier');
