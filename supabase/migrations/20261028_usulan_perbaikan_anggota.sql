-- Sudah diterapkan ke project kkg-pai-sd. Disimpan sebagai catatan.
create table public.usulan_anggota (
  id bigint generated always as identity primary key,
  anggota_id bigint not null references public.anggota(id) on delete cascade,
  nama text not null check (char_length(nama) between 1 and 150),
  nip text check (char_length(nip) <= 30),
  sekolah text not null check (char_length(sekolah) between 1 and 150),
  kelurahan text not null check (char_length(kelurahan) <= 50),
  gugus text not null check (char_length(gugus) <= 100),
  status text not null check (char_length(status) <= 50),
  sertifikasi text not null check (sertifikasi in ('Belum', 'Sudah')),
  foto_path text check (foto_path is null or foto_path like 'daftar/%'),
  catatan text check (char_length(catatan) <= 500),
  created_at timestamptz not null default now()
);
alter table public.usulan_anggota enable row level security;
create policy "anggota mengusulkan perbaikan" on public.usulan_anggota for insert to anon, authenticated with check (true);
create policy "pengurus membaca usulan" on public.usulan_anggota for select to authenticated using (true);
create policy "pengurus menghapus usulan" on public.usulan_anggota for delete to authenticated using (true);

create function public.daftar_anggota_publik_v3()
returns table (id bigint, nama text, sekolah text, kelurahan text, gugus text, status text, sertifikasi text, foto_path text)
language sql stable security definer set search_path = public as $$
  select id, nama, sekolah, kelurahan, gugus, status, sertifikasi, foto_path from anggota where disetujui order by gugus, sekolah, nama;
$$;
revoke execute on function public.daftar_anggota_publik_v3() from public;
grant execute on function public.daftar_anggota_publik_v3() to anon, authenticated;
