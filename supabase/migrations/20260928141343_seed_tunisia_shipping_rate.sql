-- Standard shipping for Tunisia, matching the defaults in site_settings
-- (7 TND, free above the global threshold). Without a row, calculateShipping
-- logs an error on every checkout before falling back to the same values.
insert into public.shipping_rates (country, country_code, shipping_method, base_rate, free_shipping_threshold)
values ('Tunisia', 'TN', 'standard', 7, null)
on conflict (country_code, shipping_method) do nothing;
