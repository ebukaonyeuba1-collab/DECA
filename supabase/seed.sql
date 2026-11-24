-- DECA reference data (not demo data). Safe to re-run. Edit via the admin dashboard once it exists.
insert into public.service_categories(slug, name, icon, sort_order) values
 ('plumbing','Plumbing','droplet',1),('electrical','Electrical services','zap',2),('cleaning','Cleaning','sparkles',3),
 ('air-conditioning-refrigeration','Air conditioning and refrigeration','wind',4),('carpentry','Carpentry','hammer',5),
 ('painting','Painting','paintbrush',6),('tiling','Tiling','layout-grid',7),('masonry','Masonry','brick-wall',8),
 ('furniture-interior','Furniture and interior services','sofa',9),('appliance-repairs','Appliance repairs','wrench',10),
 ('gardening-landscaping','Gardening and landscaping','trees',11),('moving-relocation','Moving and relocation','truck',12),
 ('pest-control','Pest control','bug',13),('laundry','Laundry','shirt',14),('beauty-personal-care','Beauty and personal care','scissors',15),
 ('automotive','Automotive services','car',16),('technology-it-support','Technology and IT support','laptop',17),
 ('other','Other professional services','briefcase',99)
on conflict (slug) do nothing;

insert into public.service_subcategories(category_id, slug, name, sort_order)
select c.id, s.slug, s.name, s.ord from public.service_categories c join (values
 ('plumbing','pipe-repairs','Pipe repairs',1),('plumbing','leak-detection','Leak detection',2),('plumbing','bathroom-plumbing','Bathroom plumbing',3),
 ('plumbing','kitchen-plumbing','Kitchen plumbing',4),('plumbing','water-installation','Water installation',5),('plumbing','plumbing-maintenance','General plumbing maintenance',6),
 ('cleaning','residential-cleaning','Residential cleaning',1),('cleaning','deep-cleaning','Deep cleaning',2),('cleaning','move-in-cleaning','Move-in cleaning',3),
 ('cleaning','move-out-cleaning','Move-out cleaning',4),('cleaning','office-cleaning','Office cleaning',5),
 ('electrical','electrical-repairs','Electrical repairs',1),('electrical','wiring','Wiring',2),('electrical','lighting-installation','Lighting installation',3),
 ('electrical','troubleshooting','Electrical troubleshooting',4),('electrical','electrical-maintenance','Electrical maintenance',5),
 ('air-conditioning-refrigeration','ac-installation','AC installation',1),('air-conditioning-refrigeration','ac-servicing','AC servicing',2),
 ('air-conditioning-refrigeration','ac-repairs','AC repairs',3),('air-conditioning-refrigeration','gas-charging','Gas charging',4),
 ('air-conditioning-refrigeration','ac-maintenance','AC maintenance',5)
) as s(cat, slug, name, ord) on s.cat = c.slug
on conflict (category_id, slug) do nothing;

-- Locations: Nigeria and its 36 states plus FCT. Cities and neighbourhoods are added by admins or later imports.
insert into public.locations(level, name, slug, code) values ('country','Nigeria','nigeria','NG') on conflict do nothing;
insert into public.locations(parent_id, level, name, slug)
select (select id from public.locations where level = 'country' and slug = 'nigeria'), 'state', s, lower(regexp_replace(s, '[^A-Za-z]+', '-', 'g'))
from unnest(array['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu',
  'Federal Capital Territory','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo',
  'Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara']) s
on conflict do nothing;

-- Verification requirements: baseline only. Category rules below are optional examples; administrators tune them.
insert into public.verification_requirements(category_id, applies_to_account_type, kind, name, description, is_required, sort_order) values
 (null, null, 'identity', 'Government-issued identification', 'A valid national ID, driver''s licence, passport or voter''s card.', true, 1),
 (null, 'business', 'business_document', 'Business registration document', 'CAC registration certificate or equivalent.', true, 2)
on conflict do nothing;
insert into public.verification_requirements(category_id, kind, name, description, is_required, sort_order)
select c.id, 'licence', 'Trade certificate or licence', 'Where the trade is regulated or you hold one. Not required unless an administrator enables it.', false, 10
  from public.service_categories c where c.slug in ('electrical','air-conditioning-refrigeration','plumbing')
on conflict do nothing;
