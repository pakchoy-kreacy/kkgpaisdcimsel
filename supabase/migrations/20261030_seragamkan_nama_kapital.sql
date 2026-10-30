-- Sudah diterapkan ke project kkg-pai-sd (23 nama). Disimpan sebagai catatan.
update public.anggota
set nama = initcap(split_part(nama, ',', 1)) || substr(nama, length(split_part(nama, ',', 1)) + 1)
where split_part(nama, ',', 1) = upper(split_part(nama, ',', 1))
  and split_part(nama, ',', 1) ~ '[A-Z]{2}';
