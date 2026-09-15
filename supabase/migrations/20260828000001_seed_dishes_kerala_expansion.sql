-- FITTAYI dish seed data: Kerala expansion batch
-- Source: user-supplied list of 42 Kerala dishes. 17 were duplicates or
-- near-duplicates of dishes already in the catalog (e.g. "Dosa with Chutney"
-- vs existing "Plain Dosa with Chutney", "Vellayappam with Mutton Stew" vs
-- existing "Appam with Mutton Stew" -- vellayappam and appam are the same
-- dish) and were skipped rather than inserted as clutter.
--
-- The source list only gave calorie ranges and free-text descriptions, no
-- macros -- this schema requires protein_g/carbs_g/fat_g (NOT NULL). Macros
-- below are estimated by calibrating against comparable dishes already in
-- the catalog (e.g. "Idiyappam with Mutton Curry" benchmarked against the
-- existing "Chicken Curry with Idiyappam" / "Idiyappam with Egg Roast"
-- rows), not independently sourced from IFCT line items the way the
-- original 168+17 dish catalog was. Flag for review/correction against real
-- IFCT figures before treating these as launch-quality data.
--
-- restrictions_ok left NULL, consistent with the rest of the catalog.

insert into dishes (
  name, meal_type, cuisine_region, diet_type, calories, protein_g, carbs_g, fat_g,
  fiber_g, serving_size, serving_weight_g, prep_time_minutes, allergens, data_source
) values
-- Breakfast
('Idiyappam with Egg Curry', '{"breakfast"}', 'Kerala', 'egg', 330, 14, 50, 10, 3, '3 strings + egg curry', 280, 20, '{"egg"}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Uppumavu (Rava Upma)', '{"breakfast"}', 'South India', 'veg', 230, 5, 38, 7, 2, '1 bowl, plain', 200, 15, '{"gluten"}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Kanji with Payar Curry', '{"breakfast","dinner"}', 'Kerala', 'vegan', 230, 9, 40, 5, 6, '1 bowl kanji + payar curry', 350, 25, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Pathiri with Chicken Curry', '{"breakfast","dinner"}', 'Malabar/Kerala', 'non_veg', 375, 22, 42, 13, 2, '2 pathiri + chicken curry', 300, 30, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Chatti Pathiri', '{"breakfast","snack"}', 'Malabar/Kerala', 'egg', 300, 10, 32, 14, 1, '1 slice', 150, 45, '{"egg","milk","gluten"}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),

-- Lunch
('Rice with Sambar', '{"lunch","dinner"}', 'Kerala/Tamil Nadu', 'vegan', 320, 10, 58, 6, 5, '1 cup rice + sambar', 350, 25, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Rice with Fish Curry', '{"lunch","dinner"}', 'Kerala', 'non_veg', 420, 26, 52, 12, 2, '1 cup rice + fish curry', 380, 30, '{"fish"}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Rice with Avial', '{"lunch","dinner"}', 'Kerala', 'veg', 320, 7, 56, 8, 5, '1 cup rice + avial', 350, 25, '{"milk"}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Rice with Thoran', '{"lunch","dinner"}', 'Kerala', 'vegan', 300, 7, 56, 6, 5, '1 cup rice + mixed vegetable thoran', 320, 20, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Rice with Rasam', '{"lunch","dinner"}', 'Tamil Nadu/Kerala', 'vegan', 260, 6, 52, 3, 3, '1 cup rice + rasam', 320, 20, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Rice with Kaalan', '{"lunch"}', 'Kerala', 'veg', 340, 8, 55, 9, 4, '1 cup rice + kaalan', 350, 30, '{"milk"}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Rice with Olan', '{"lunch"}', 'Kerala', 'vegan', 300, 6, 54, 7, 4, '1 cup rice + olan', 340, 25, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Rice with Beef Fry', '{"lunch","dinner"}', 'Kerala', 'non_veg', 480, 28, 50, 18, 2, '1 cup rice + beef fry', 380, 35, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),

-- Dinner
('Idiyappam with Mutton Curry', '{"dinner"}', 'Kerala', 'non_veg', 425, 24, 48, 16, 3, '3 strings + mutton curry', 320, 40, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Rice Kanji with Pickle', '{"dinner"}', 'Kerala', 'vegan', 180, 3, 36, 2, 2, '1 bowl kanji + pickle', 320, 15, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Ghee Rice with Chicken Curry', '{"dinner"}', 'Kerala', 'non_veg', 520, 24, 58, 20, 2, 'ghee rice + chicken curry', 380, 35, '{"milk"}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Chapati with Kadala Curry', '{"breakfast","dinner"}', 'Kerala', 'vegan', 330, 12, 52, 8, 7, '2 chapati + kadala curry', 280, 25, '{"gluten"}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),

-- Snacks
('Pazham Pori', '{"snack"}', 'Kerala', 'vegan', 165, 2, 28, 6, 2, '1 piece', 80, 15, '{"gluten"}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Achappam', '{"snack"}', 'Kerala', 'vegan', 130, 2, 16, 7, 1, '2 pieces', 40, 20, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Kuzhalappam', '{"snack"}', 'Kerala', 'vegan', 110, 1, 15, 5, 1, '2 pieces', 35, 15, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Sukhiyan', '{"snack"}', 'Kerala', 'vegan', 160, 4, 22, 7, 3, '2 pieces', 60, 20, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Elaneer (Tender Coconut Water)', '{"snack"}', 'Kerala', 'vegan', 50, 1, 10, 0.5, 1, '1 glass', 240, 5, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Chakka Varuthathu (Fried Jackfruit Chips)', '{"snack"}', 'Kerala', 'vegan', 150, 1, 20, 7, 2, '~30g handful', 30, 5, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Kozhi Porichathu (Kerala Fried Chicken)', '{"snack"}', 'Kerala', 'non_veg', 270, 22, 8, 17, 0, 'small portion (2-3 pieces)', 150, 10, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)'),
('Chembu Chips (Colocasia Chips)', '{"snack"}', 'Kerala', 'vegan', 140, 1, 18, 7, 2, '~30g handful', 30, 5, '{}', 'Estimated (calibrated against comparable catalog dishes, not independently IFCT-sourced)');
