-- Disposable schema matching the minimum read-only verified live attendance contract.
-- Not customer data, not an app-connected Supabase project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.app_users(id uuid PRIMARY KEY);
CREATE TABLE public.stations(
 id uuid PRIMARY KEY,latitude numeric,longitude numeric,timezone text NOT NULL DEFAULT 'Asia/Bangkok');
CREATE TABLE public.employees(
 id uuid PRIMARY KEY,station_id uuid NOT NULL REFERENCES public.stations(id),
 user_id uuid REFERENCES public.app_users(id),display_name text NOT NULL,
 employment_status text NOT NULL DEFAULT 'active');
CREATE TABLE public.memberships(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.app_users(id),
 station_id uuid,scope_type text NOT NULL,role_code text NOT NULL,
 active boolean NOT NULL DEFAULT true);
CREATE TABLE public.attendance_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id uuid NOT NULL REFERENCES public.employees(id),
 event_type text NOT NULL CHECK(event_type IN ('clock_in','clock_out','break_start','break_end')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 latitude numeric,longitude numeric,accuracy_meters numeric,
 geofence_status text,review_status text NOT NULL DEFAULT 'accepted'
   CHECK(review_status IN ('accepted','pending','rejected')),
 recorded_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.app_users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
INSERT INTO public.stations(id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.employees(id,station_id,user_id,display_name,employment_status) VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222','Employee A','active'),
 ('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','Manager A','active'),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '44444444-4444-4444-8444-444444444444','Employee B','active');
INSERT INTO public.memberships(user_id,station_id,scope_type,role_code)
VALUES('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','station','manager'),
 ('33333333-3333-4333-8333-333333333333',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','station','manager');
