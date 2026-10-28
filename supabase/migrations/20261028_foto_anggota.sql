-- Sudah diterapkan ke project kkg-pai-sd. Disimpan sebagai catatan.
alter table public.anggota add column foto_path text check (char_length(foto_path) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-anggota', 'foto-anggota', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "pendaftar unggah foto anggota" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'foto-anggota' and (storage.foldername(name))[1] = 'daftar');
create policy "pengurus unggah foto anggota" on storage.objects for insert to authenticated with check (bucket_id = 'foto-anggota');
create policy "pengurus baca foto anggota" on storage.objects for select to authenticated using (bucket_id = 'foto-anggota');
create policy "pengurus hapus foto anggota" on storage.objects for delete to authenticated using (bucket_id = 'foto-anggota');

create function public.daftar_anggota_publik_v2()
returns table (nama text, sekolah text, kelurahan text, gugus text, status text, sertifikasi text, foto_path text)
language sql stable security definer set search_path = public as $$
  select nama, sekolah, kelurahan, gugus, status, sertifikasi, foto_path from anggota where disetujui order by gugus, sekolah, nama;
$$;
revoke execute on function public.daftar_anggota_publik_v2() from public;
grant execute on function public.daftar_anggota_publik_v2() to anon, authenticated;
