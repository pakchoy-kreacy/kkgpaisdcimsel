-- Sudah diterapkan ke project kkg-pai-sd. Disimpan sebagai catatan.
alter table public.pengaturan add column hero_path text check (char_length(hero_path) <= 300);
