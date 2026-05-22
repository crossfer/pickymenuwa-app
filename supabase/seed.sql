-- ============================================================
-- seed.sql — Sample data for local development
-- Run AFTER migrations: supabase db reset
-- ============================================================

-- ① Insert a sample restaurant
insert into public.restaurants (id, name, slug, timezone)
values
  ('11111111-1111-1111-1111-111111111111', 'La Bella Cucina', 'la-bella-cucina', 'America/Los_Angeles'),
  ('22222222-2222-2222-2222-222222222222', 'Taco Mundo', 'taco-mundo', 'America/Chicago')
on conflict (id) do nothing;

-- ② Categories for La Bella Cucina
insert into public.categories (id, restaurant_id, name, sort_order)
values
  ('aaaaaaaa-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Antipasti', 0),
  ('aaaaaaaa-0001-0001-0001-000000000002', '11111111-1111-1111-1111-111111111111', 'Pasta', 1),
  ('aaaaaaaa-0001-0001-0001-000000000003', '11111111-1111-1111-1111-111111111111', 'Pizza', 2),
  ('aaaaaaaa-0001-0001-0001-000000000004', '11111111-1111-1111-1111-111111111111', 'Dolci', 3)
on conflict (id) do nothing;

-- ③ Menu items for La Bella Cucina
insert into public.menu_items
  (id, restaurant_id, category_id, name, description, price, available, chef_recommendation, chef_note)
values
  -- Antipasti
  ('bbbbbbbb-0001-0001-0001-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'Bruschetta al Pomodoro',
   'Grilled bread rubbed with garlic, topped with fresh tomatoes, basil, and olive oil.',
   8.50, true, false, null),

  ('bbbbbbbb-0001-0001-0001-000000000002',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'Burrata Caprese',
   'Creamy burrata with heirloom tomatoes, fresh basil, and aged balsamic.',
   14.00, true, true, 'Made with imported burrata from Puglia — a must-try!'),

  -- Pasta
  ('bbbbbbbb-0001-0001-0001-000000000003',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-0001-0001-000000000002',
   'Cacio e Pepe',
   'Classic Roman pasta with Pecorino Romano and freshly cracked black pepper.',
   16.00, true, true, 'Simple but perfect. Use our house-made tonnarelli.'),

  ('bbbbbbbb-0001-0001-0001-000000000004',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-0001-0001-000000000002',
   'Tagliatelle al Ragù',
   'Hand-rolled egg pasta with a slow-cooked Bolognese meat sauce.',
   18.00, true, false, null),

  -- Pizza
  ('bbbbbbbb-0001-0001-0001-000000000005',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-0001-0001-000000000003',
   'Margherita',
   'San Marzano tomato, fresh mozzarella, basil, extra virgin olive oil.',
   15.00, true, false, null),

  ('bbbbbbbb-0001-0001-0001-000000000006',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-0001-0001-000000000003',
   'Truffle & Mushroom',
   'White base, mixed wild mushrooms, fontina, black truffle oil, arugula.',
   22.00, true, true, 'Weekend special — available Fri–Sun only.'),

  -- Dolci
  ('bbbbbbbb-0001-0001-0001-000000000007',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-0001-0001-000000000004',
   'Tiramisu',
   'Classic tiramisu with mascarpone, espresso-soaked ladyfingers, and cocoa.',
   9.00, true, false, null),

  ('bbbbbbbb-0001-0001-0001-000000000008',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-0001-0001-000000000004',
   'Panna Cotta',
   'Vanilla panna cotta with seasonal berry coulis.',
   8.00, false, false, null)   -- sold out example

on conflict (id) do nothing;

-- ④ Schedule for Truffle & Mushroom (Fri–Sun only, all day)
insert into public.item_schedules (item_id, day_of_week, time_start, time_end)
values
  ('bbbbbbbb-0001-0001-0001-000000000006', '{5,6,0}', '11:00', '22:00')
on conflict do nothing;

-- ⑤ Categories for Taco Mundo
insert into public.categories (id, restaurant_id, name, sort_order)
values
  ('cccccccc-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222', 'Tacos', 0),
  ('cccccccc-0001-0001-0001-000000000002', '22222222-2222-2222-2222-222222222222', 'Burritos', 1),
  ('cccccccc-0001-0001-0001-000000000003', '22222222-2222-2222-2222-222222222222', 'Bebidas', 2)
on conflict (id) do nothing;

-- ⑥ A couple of Taco Mundo items
insert into public.menu_items
  (id, restaurant_id, category_id, name, description, price, available, chef_recommendation)
values
  ('dddddddd-0001-0001-0001-000000000001',
   '22222222-2222-2222-2222-222222222222',
   'cccccccc-0001-0001-0001-000000000001',
   'Taco al Pastor',
   'Slow-marinated pork, pineapple, cilantro, onion.',
   4.50, true, true),

  ('dddddddd-0001-0001-0001-000000000002',
   '22222222-2222-2222-2222-222222222222',
   'cccccccc-0001-0001-0001-000000000002',
   'Burrito de Carnitas',
   'Slow-cooked pork, rice, beans, sour cream, salsa.',
   12.00, true, false)

on conflict (id) do nothing;
