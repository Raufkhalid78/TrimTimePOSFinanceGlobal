
-- ==========================================
-- TRIMTIME POS - SAAS MULTI-TENANT SCHEMA
-- Run this in Supabase SQL Editor
-- WARNING: This will WIPE existing data!
-- ==========================================

-- 1. CLEANUP
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS shops CASCADE;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. SHOPS (The Tenant)
-- ==========================================
create table shops (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  owner_id uuid references auth.users not null, -- Links to Supabase Auth User
  name text default 'My Barber Shop',
  subscription_status text default 'active', -- 'active', 'past_due', 'canceled'
  stripe_customer_id text
);

-- ==========================================
-- 2. DATA TABLES (Tenanted)
-- ==========================================

-- Staff Table (For local app switching, not SaaS login)
create table staff (
  id text primary key,
  shop_id uuid references shops(id) not null,
  name text not null,
  role text not null check (role in ('admin', 'employee')),
  commission numeric default 0,
  username text not null,
  password text not null, 
  email text
);

-- Services
create table services (
  id text primary key,
  shop_id uuid references shops(id) not null,
  name text not null,
  price numeric default 0,
  duration numeric default 30,
  category text
);

-- Products
create table products (
  id text primary key,
  shop_id uuid references shops(id) not null,
  name text not null,
  price numeric default 0,
  cost numeric default 0,
  stock numeric default 0,
  barcode text,
  low_stock_threshold numeric default 15
);

-- Customers
create table customers (
  id text primary key,
  shop_id uuid references shops(id) not null,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at text
);

-- Sales
create table sales (
  id text primary key,
  shop_id uuid references shops(id) not null,
  timestamp text not null,
  items jsonb,
  staff_id text references staff(id) on delete set null,
  customer_id text references customers(id) on delete set null,
  total numeric default 0,
  tax numeric default 0,
  discount numeric default 0,
  discount_code text,
  payment_method text check (payment_method in ('cash', 'card', 'wallet')),
  tax_type text check (tax_type in ('included', 'excluded')),
  customer_name text, 
  professional_name text
);

-- Expenses
create table expenses (
  id text primary key,
  shop_id uuid references shops(id) not null,
  date text not null,
  category text,
  amount numeric default 0,
  description text,
  receipt_image text
);

-- Settings (One row per shop)
create table settings (
  shop_id uuid references shops(id) primary key,
  data jsonb
);

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
alter table shops enable row level security;
alter table staff enable row level security;
alter table services enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;
alter table settings enable row level security;

-- Policy: SHOPS
-- Owners can only see/edit their own shop
create policy "Users can view own shop" on shops for select using (owner_id = auth.uid());
create policy "Users can update own shop" on shops for update using (owner_id = auth.uid());

-- Policy: DATA TABLES
-- Users can only access data belonging to a shop they own
-- Note: In a production environment with millions of rows, consider using claims or a dedicated lookup function for performance.
-- For this scale, a subquery is perfectly fine and secure.

create policy "Owner access staff" on staff for all using (shop_id in (select id from shops where owner_id = auth.uid()));
create policy "Owner access services" on services for all using (shop_id in (select id from shops where owner_id = auth.uid()));
create policy "Owner access products" on products for all using (shop_id in (select id from shops where owner_id = auth.uid()));
create policy "Owner access customers" on customers for all using (shop_id in (select id from shops where owner_id = auth.uid()));
create policy "Owner access sales" on sales for all using (shop_id in (select id from shops where owner_id = auth.uid()));
create policy "Owner access expenses" on expenses for all using (shop_id in (select id from shops where owner_id = auth.uid()));
create policy "Owner access settings" on settings for all using (shop_id in (select id from shops where owner_id = auth.uid()));

-- ==========================================
-- 4. AUTOMATION TRIGGERS
-- ==========================================

-- Function to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
declare
  new_shop_id uuid;
begin
  -- 1. Create a Shop for the new user
  insert into public.shops (owner_id, name) 
  values (new.id, 'My Barber Shop') 
  returning id into new_shop_id;

  -- 2. Create Default Settings for that shop
  insert into public.settings (shop_id, data) 
  values (new_shop_id, '{
    "shopName": "TrimTime", 
    "currency": "$", 
    "language": "en", 
    "taxRate": 0, 
    "taxType": "excluded", 
    "whatsappEnabled": true,
    "billingCycleDay": 1,
    "promoCodes": []
  }'::jsonb);

  -- 3. Create an initial Admin Staff profile (for the POS PIN login)
  -- This allows the owner to log into the "App" immediately after signing up
  insert into public.staff (id, shop_id, name, role, commission, username, password)
  values (
    'st_' || substr(md5(random()::text), 0, 8), -- Random ID
    new_shop_id, 
    'Owner', 
    'admin', 
    0, 
    'admin', 
    '1234'
  );
  
  -- 4. Add some default services so the catalog isn't empty
  insert into public.services (id, shop_id, name, price, duration, category) values
  ('svc_' || substr(md5(random()::text), 0, 8), new_shop_id, 'Classic Haircut', 30, 30, 'Hair'),
  ('svc_' || substr(md5(random()::text), 0, 8), new_shop_id, 'Beard Trim', 20, 20, 'Beard');

  return new;
end;
$$ language plpgsql security definer;

-- Bind the trigger to the auth.users table
-- This fires every time a user signs up via Supabase Auth
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
