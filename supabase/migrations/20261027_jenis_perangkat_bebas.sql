-- Jalankan di Supabase Dashboard -> SQL Editor -> Run.
-- 1) Jenis perangkat ajar mengikuti daftar di admin -> Pengaturan, bukan daftar tetap.
alter table public.perangkat_ajar drop constraint perangkat_ajar_jenis_check;
alter table public.perangkat_ajar add constraint perangkat_ajar_jenis_len check (char_length(jenis) between 1 and 60);
-- 2) Tutup data anggota (termasuk NIP) dari akses publik.
drop policy if exists "anggota disetujui bisa dibaca publik" on public.anggota;
