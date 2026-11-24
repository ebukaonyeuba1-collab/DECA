-- DECA Stage 1 refinement | 0012 | uniqueness the seed and admin tools rely on
-- NULL parents are distinct in a plain UNIQUE(parent_id, slug), so root locations need their own index;
-- the same applies to baseline verification requirements (category_id null).
create unique index locations_root_slug_uq on public.locations (slug) where parent_id is null;
create unique index verification_requirements_uq on public.verification_requirements
  (coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, name);
