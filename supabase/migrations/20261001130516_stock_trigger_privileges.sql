-- The stock triggers call other objects in the private schema (sync_online_stock, variant_sku,
-- product_code_seq). Callers (service_role) have no usage on that schema, so these functions run
-- as their owner. All of them already pin search_path = ''.
alter function private.apply_stock_movement() security definer;
alter function private.sync_online_stock(uuid[]) security definer;
alter function private.on_product_tracking_change() security definer;
alter function private.on_online_location_change() security definer;
alter function private.set_product_code() security definer;
alter function private.variant_sku(public.product_variants) security definer;
alter function private.set_variant_sku() security definer;

revoke all on function private.apply_stock_movement(), private.sync_online_stock(uuid[]),
  private.on_product_tracking_change(), private.on_online_location_change(), private.set_product_code(),
  private.variant_sku(public.product_variants), private.set_variant_sku() from public, anon, authenticated;
