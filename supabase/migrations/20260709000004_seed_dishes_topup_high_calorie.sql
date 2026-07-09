-- FITTAYI high-calorie top-up batch
-- 17 dishes, 700-950 kcal, added to fix a coverage gap: the
-- original 168-dish catalog topped out around 480-650 kcal per meal slot,
-- so higher-calorie users (including the PRD's own worked example, 75kg
-- moderate male / cut -> 737 kcal lunch target) got no lunch/dinner match.
-- Reviewed with the product owner before commit, same as the original batches.

insert into dishes (
  name, meal_type, cuisine_region, diet_type, calories, protein_g, carbs_g, fat_g,
  fiber_g, serving_size, serving_weight_g, prep_time_minutes, allergens, data_source
) values
('Rice with Chicken Curry & Beef Fry', '{"lunch","dinner"}', 'Kerala', 'non_veg', 780, 42, 78, 30, 5, 'extra-large plate', 550, 40, '{}', 'IFCT 2017 (derived from ingredient composition)'),
('Large Malabar Chicken Biryani', '{"lunch","dinner"}', 'Kerala', 'non_veg', 850, 38, 98, 30, 4, 'extra-large plate', 600, 45, '{}', 'IFCT 2017 (derived from ingredient composition)'),
('Rice with Fish Curry, Thoran & Papadam', '{"lunch","dinner"}', 'Kerala', 'non_veg', 720, 34, 92, 20, 6, 'extra-large plate', 550, 35, '{"fish"}', 'IFCT 2017 (derived from ingredient composition)'),
('Bulk Kerala Sadya', '{"lunch"}', 'Kerala', 'veg', 900, 18, 150, 24, 12, 'extended thali with payasam', 750, 60, '{"milk"}', 'IFCT 2017 (derived from ingredient composition)'),
('Double Chapati with Paneer Butter Masala & Dal', '{"lunch","dinner"}', 'North India/Pan-India', 'veg', 780, 28, 88, 32, 8, '5 chapati + masala + dal', 500, 30, '{"gluten","milk"}', 'IFCT 2017 (derived from ingredient composition)'),
('Rice, Sambar, Avial, Thoran & Fish Fry', '{"lunch","dinner"}', 'Kerala', 'non_veg', 760, 34, 98, 22, 8, 'mega combo plate', 550, 40, '{"fish"}', 'IFCT 2017 (derived from ingredient composition)'),
('Ghee Rice with Chicken Roast & Boiled Egg', '{"lunch","dinner"}', 'Kerala', 'non_veg', 820, 40, 86, 28, 3, 'extra-large plate', 550, 40, '{"egg","milk"}', 'IFCT 2017 (derived from ingredient composition)'),
('Double Malabar Parotta with Beef Curry & Egg Roast', '{"lunch","dinner"}', 'Kerala', 'non_veg', 880, 36, 86, 42, 4, '4 parotta + curry + egg roast', 550, 35, '{"gluten","egg"}', 'IFCT 2017 (derived from ingredient composition)'),
('Rice with Mutton Curry, Beans Thoran & Papadam', '{"lunch","dinner"}', 'Kerala', 'non_veg', 800, 38, 84, 30, 6, 'extra-large plate', 550, 45, '{}', 'IFCT 2017 (derived from ingredient composition)'),
('Bulking Bowl: Rice, Chicken Curry & 2 Boiled Eggs with Thoran', '{"lunch","dinner"}', 'Fitness/Kerala', 'non_veg', 760, 48, 82, 22, 5, '1 large bowl', 550, 35, '{"egg"}', 'IFCT 2017 (derived from ingredient composition)'),
('Vegetable Biryani with Paneer Kurma & Raita', '{"lunch","dinner"}', 'Kerala/South India', 'veg', 750, 20, 98, 26, 6, 'extra-large plate', 550, 40, '{"milk"}', 'IFCT 2017 (derived from ingredient composition)'),
('Rajma-Chawal Mega Bowl with Extra Dal & Peanuts', '{"lunch","dinner"}', 'North India/Pan-India', 'vegan', 720, 22, 112, 16, 16, '1 large bowl', 550, 30, '{"peanut"}', 'IFCT 2017 (derived from ingredient composition)'),
('Triple Egg Curry with Extra Rice & Thoran', '{"lunch","dinner"}', 'Kerala', 'egg', 700, 24, 96, 20, 6, '3-egg curry + extra rice', 550, 25, '{"egg"}', 'IFCT 2017 (derived from ingredient composition)'),
('Chicken Dum Biryani (large) with Raita & Boiled Egg', '{"lunch","dinner"}', 'Pan-India', 'non_veg', 900, 42, 98, 32, 4, 'extra-large plate', 600, 50, '{"egg","milk"}', 'IFCT 2017 (derived from ingredient composition)'),
('Bulking Puttu with Kadala Curry, Banana & 2 Eggs', '{"breakfast"}', 'Fitness/Kerala', 'egg', 700, 26, 92, 22, 8, '3 cylinders + curry + banana + eggs', 450, 30, '{"egg"}', 'IFCT 2017 (derived from ingredient composition)'),
('Bulking Chicken Shawarma Plate with Rice & Salad', '{"lunch","dinner"}', 'Fitness/Pan-India', 'non_veg', 820, 44, 78, 32, 5, '1 large plate', 500, 30, '{"gluten"}', 'IFCT 2017 (derived from ingredient composition)'),
('Vegan Bulking Bowl: Double Dal, Rice & Roasted Peanuts', '{"lunch","dinner"}', 'Fitness/Pan-India', 'vegan', 720, 24, 110, 18, 16, '1 large bowl', 550, 30, '{"peanut"}', 'IFCT 2017 (derived from ingredient composition)');

