/**
 * Stock management shared between the admin UI and the /api/stock routes.
 * Stock is never written directly: every change is a stock_movements row (written by the
 * record_stock_movements / set_order_status / save_product database functions), and the
 * database trigger keeps inventory_levels (and the online product_variants.stock) in sync.
 */

export type MovementType = 'sale' | 'restock' | 'adjustment' | 'return' | 'transfer';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'untracked';

export const MOVEMENT_TYPES: MovementType[] = ['restock', 'sale', 'return', 'adjustment', 'transfer'];

export const MOVEMENT_LABELS: Record<MovementType, string> = {
    restock: 'Restock',
    sale: 'Sale',
    return: 'Return',
    adjustment: 'Adjustment',
    transfer: 'Transfer',
};

export const STATUS_LABELS: Record<StockStatus, string> = {
    in_stock: 'In stock',
    low_stock: 'Low stock',
    out_of_stock: 'Out of stock',
    untracked: 'Not tracked',
};

/** Out at 0, low at or below the reorder point, otherwise in stock. */
export function stockStatus(available: number, reorderPoint: number, tracked = true): StockStatus {
    if (!tracked) return 'untracked';
    if (available <= 0) return 'out_of_stock';
    if (available <= reorderPoint) return 'low_stock';
    return 'in_stock';
}

/** Turns database errors from stock writes into messages an admin can act on. */
export function stockErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
    const message = error?.message ?? '';
    const shortage = message.match(/insufficient_stock:([^:]+):(-?\d+)/);
    if (shortage) return `Not enough stock for ${shortage[1]} (only ${shortage[2]} available at that location).`;
    if (message.includes('no_online_location')) return 'No location is set to sell online. Choose one in Stock settings.';
    const stocked = message.match(/variants_with_stock:(\d+)/);
    if (stocked) return `${stocked[1]} variant(s) you removed still have stock. Move or adjust their stock to zero first.`;
    if (message.includes('negative_count')) return 'Counted quantities cannot be negative.';
    if (message.includes('invalid_transfer')) return 'Choose a different destination location.';
    if (message.includes('product_not_found')) return 'This product no longer exists.';
    if (message.includes('stock_movements_direction')) return 'Sales must remove stock and restocks/returns must add it.';
    if (error?.code === '23503') return 'This item is still in use and cannot be removed.';
    if (error?.code === '23505') return 'That name is already taken.';
    return message || 'Something went wrong while updating stock.';
}
