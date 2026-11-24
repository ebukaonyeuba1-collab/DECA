-- DECA Stage 1 | 0001 | extensions and enumerated types
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.user_role as enum ('customer','professional','admin','super_admin');
create type public.account_status as enum ('active','suspended','deactivated');
create type public.account_type as enum ('individual','business');
create type public.location_level as enum ('country','state','city','neighbourhood');
create type public.verification_status as enum ('not_started','incomplete','submitted','under_review','additional_information_required','approved','rejected','suspended');
create type public.document_review_status as enum ('pending','accepted','rejected');
create type public.requirement_kind as enum ('identity','qualification','licence','certification','experience_evidence','business_document','proof_of_address','other');
create type public.pricing_type as enum ('fixed','starting','hourly','daily','per_project','inspection_based');
create type public.quotation_status as enum ('draft','sent','accepted','rejected','expired','revised','withdrawn');
create type public.booking_status as enum ('pending','quotation_requested','quotation_sent','awaiting_approval','confirmed','awaiting_payment','payment_secured','scheduled','in_progress','awaiting_customer_confirmation','completed','cancelled','disputed','refunded');
create type public.booking_actor as enum ('customer','professional','admin','system');
create type public.payment_status as enum ('initiated','pending','succeeded','failed','abandoned','partially_refunded','refunded');
create type public.payout_status as enum ('pending','processing','paid','failed','reversed');
create type public.refund_status as enum ('requested','approved','processing','completed','rejected');
create type public.dispute_status as enum ('submitted','under_review','awaiting_customer_response','awaiting_professional_response','resolution_proposed','resolved','rejected');
create type public.subscription_tier as enum ('free','professional','business');
create type public.subscription_status as enum ('active','past_due','cancelled','expired');
