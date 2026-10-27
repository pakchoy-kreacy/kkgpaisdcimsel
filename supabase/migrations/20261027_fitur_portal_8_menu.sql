-- Fitur portal 8 menu: profil, pengurus, perangkat ajar, agenda, informasi, presensi.
-- Jalankan sekali di Supabase Dashboard -> SQL Editor -> Run.

alter table public.pengaturan add column profil text not null default '' check (char_length(profil) <= 4000);

create table public.pengurus (
  id bigint generated always as identity primary key,
  nama text not null check (char_length(nama) between 1 and 150),
  jabatan text not null check (char_length(jabatan) between 1 and 100),
  urutan int not null default 100,
  foto_path text,
  created_at timestamptz not null default now()
);

create table public.perangkat_ajar (
  id bigint generated always as identity primary key,
  judul text not null check (char_length(judul) between 1 and 200),
  jenis text not null check (jenis in ('Modul Ajar', 'ATP/CP', 'Asesmen/Soal', 'Media Ajar', 'Administrasi', 'Lainnya')),
  kelas text not null default 'Semua' check (char_length(kelas) <= 30),
  deskripsi text check (char_length(deskripsi) <= 500),
  url text check (url ~ '^https://'),
  file_path text,
  created_at timestamptz not null default now(),
  check (url is not null or file_path is not null)
);

create table public.agenda (
  id bigint generated always as identity primary key,
  judul text not null check (char_length(judul) between 1 and 200),
  kategori text not null check (char_length(kategori) <= 50),
  tanggal date not null,
  waktu text not null default '' check (char_length(waktu) <= 50),
  lokasi text not null check (char_length(lokasi) between 1 and 200),
  deskripsi text check (char_length(deskripsi) <= 1000),
  presensi_buka boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.informasi (
  id bigint generated always as identity primary key,
  judul text not null check (char_length(judul) between 1 and 200),
  isi text not null check (char_length(isi) between 1 and 3000),
  tanggal date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.presensi (
  id bigint generated always as identity primary key,
  agenda_id bigint not null references public.agenda(id) on delete cascade,
  nama text not null check (char_length(nama) between 1 and 150),
  sekolah text not null check (char_length(sekolah) between 1 and 150),
  gugus text not null check (char_length(gugus) <= 100),
  created_at timestamptz not null default now()
);
create unique index presensi_unik on public.presensi (agenda_id, lower(btrim(nama)), lower(btrim(sekolah)));

alter table public.pengurus enable row level security;
alter table public.perangkat_ajar enable row level security;
alter table public.agenda enable row level security;
alter table public.informasi enable row level security;
alter table public.presensi enable row level security;

create policy "pengurus dibaca publik" on public.pengurus for select to anon, authenticated using (true);
create policy "pengurus dikelola pengurus" on public.pengurus for all to authenticated using (true) with check (true);

create policy "perangkat dibaca publik" on public.perangkat_ajar for select to anon, authenticated using (true);
create policy "perangkat dikelola pengurus" on public.perangkat_ajar for all to authenticated using (true) with check (true);

create policy "agenda dibaca publik" on public.agenda for select to anon, authenticated using (true);
create policy "agenda dikelola pengurus" on public.agenda for all to authenticated using (true) with check (true);

create policy "informasi dibaca publik" on public.informasi for select to anon, authenticated using (true);
create policy "informasi dikelola pengurus" on public.informasi for all to authenticated using (true) with check (true);

create policy "presensi hanya saat dibuka" on public.presensi for insert to anon, authenticated
  with check (exists (select 1 from public.agenda a where a.id = agenda_id and a.presensi_buka));
create policy "presensi dibaca pengurus" on public.presensi for select to authenticated using (true);
create policy "presensi dihapus pengurus" on public.presensi for delete to authenticated using (true);

-- Daftar anggota tidak lagi dibuka untuk publik (NIP terlindungi); rekap lewat fungsi
drop policy "anggota disetujui bisa dibaca publik" on public.anggota;

create function public.rekap_beranda() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'gpai', (select count(*) from anggota where disetujui),
    'sekolah', (select count(distinct lower(btrim(sekolah))) from anggota where disetujui),
    'gugus', (select cardinality(daftar_gugus) from pengaturan where id = 1),
    'kelurahan', (select cardinality(daftar_kelurahan) from pengaturan where id = 1)
  );
$$;
revoke execute on function public.rekap_beranda() from public;
grant execute on function public.rekap_beranda() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('perangkat-ajar', 'perangkat-ajar', true, 10485760, array[
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy "perangkat ajar bisa dibaca publik" on storage.objects for select to anon, authenticated using (bucket_id = 'perangkat-ajar');
create policy "pengurus upload perangkat ajar" on storage.objects for insert to authenticated with check (bucket_id = 'perangkat-ajar');
create policy "pengurus hapus perangkat ajar" on storage.objects for delete to authenticated using (bucket_id = 'perangkat-ajar');
