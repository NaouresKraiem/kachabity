-- Update the live Tunisia delivery fee for existing installations.
update public.site_settings
set setting_value = '8', updated_at = now()
where setting_key = 'default_shipping_cost';

update public.shipping_rates
set base_rate = 8
where country_code = 'TN'
  and shipping_method = 'standard';
