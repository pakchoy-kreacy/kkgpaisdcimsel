-- Sudah diterapkan ke project kkg-pai-sd. Disimpan sebagai catatan.
alter table public.anggota add column nomor_anggota text unique check (char_length(nomor_anggota) between 1 and 40);

create function public.daftar_anggota_publik_v4()
returns table (id bigint, nomor_anggota text, nama text, sekolah text, kelurahan text, gugus text, status text, sertifikasi text, foto_path text)
language sql stable security definer set search_path = public as $$
  select id, coalesce(nomor_anggota, 'KKGPAI-CS-' || lpad(id::text, 4, '0')), nama, sekolah, kelurahan, gugus, status, sertifikasi, foto_path
  from anggota where disetujui order by gugus, sekolah, nama;
$$;
revoke execute on function public.daftar_anggota_publik_v4() from public;
grant execute on function public.daftar_anggota_publik_v4() to anon, authenticated;
