-- Sudah diterapkan ke project kkg-pai-sd. Disimpan sebagai catatan.
create table public.infaq (
  anggota_id bigint not null references public.anggota(id) on delete cascade,
  tahun int not null check (tahun between 2020 and 2100),
  tw1 boolean not null default false,
  tw2 boolean not null default false,
  tw3 boolean not null default false,
  tw4 boolean not null default false,
  keterangan text check (char_length(keterangan) <= 300),
  updated_at timestamptz not null default now(),
  primary key (anggota_id, tahun)
);
alter table public.infaq enable row level security;
create policy "laporan infaq dibaca publik" on public.infaq for select to anon, authenticated using (true);
create policy "pengurus mengisi infaq" on public.infaq for insert to authenticated with check (true);
create policy "pengurus mengubah infaq" on public.infaq for update to authenticated using (true) with check (true);
create policy "pengurus menghapus infaq" on public.infaq for delete to authenticated using (true);
alter table public.pengaturan add column koordinator_gugus jsonb not null default '{}'::jsonb;
