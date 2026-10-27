-- Sudah diterapkan ke project kkg-pai-sd. Disimpan sebagai catatan.
-- Hapus spasi di awal/akhir dan spasi ganda pada nama dan sekolah, sekarang dan seterusnya.
create function public.rapikan_nama_sekolah() returns trigger
language plpgsql set search_path = public as $$
begin
  new.nama := regexp_replace(btrim(new.nama), '\s+', ' ', 'g');
  new.sekolah := regexp_replace(btrim(new.sekolah), '\s+', ' ', 'g');
  return new;
end;
$$;

create trigger rapikan_spasi before insert or update on public.anggota
  for each row execute function public.rapikan_nama_sekolah();
create trigger rapikan_spasi before insert or update on public.presensi
  for each row execute function public.rapikan_nama_sekolah();
create trigger rapikan_spasi before insert or update on public.aspirasi
  for each row execute function public.rapikan_nama_sekolah();

update public.anggota set nama = nama where nama <> regexp_replace(btrim(nama), '\s+', ' ', 'g') or sekolah <> regexp_replace(btrim(sekolah), '\s+', ' ', 'g');
update public.presensi set nama = nama where nama <> regexp_replace(btrim(nama), '\s+', ' ', 'g') or sekolah <> regexp_replace(btrim(sekolah), '\s+', ' ', 'g');
update public.aspirasi set nama = nama where nama <> regexp_replace(btrim(nama), '\s+', ' ', 'g') or sekolah <> regexp_replace(btrim(sekolah), '\s+', ' ', 'g');
