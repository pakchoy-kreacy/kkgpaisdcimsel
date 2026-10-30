// Konfigurasi Supabase. Publishable key aman di browser; keamanan dijaga oleh RLS.
const SUPABASE_URL = 'https://xomekijmdzfdfqimycjl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_b9iztDvtg-sC-elLpyGs0g_7IC5M9Ip';
const STORAGE_BUCKET = 'dokumentasi';

// Logo bawaan; pengurus bisa menggantinya dari admin -> Pengaturan
const DEFAULT_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><circle cx="150" cy="150" r="146" fill="%23047857" stroke="%23000" stroke-width="5"/><circle cx="150" cy="150" r="122" fill="%2310b981" stroke="%23064e3b" stroke-width="4"/><g fill="none" stroke="%23f59e0b" stroke-width="8" stroke-linecap="round"><path d="M 120 180 L 120 130 L 150 100 L 180 130 L 180 180"/><path d="M 135 180 L 135 140 L 150 120 L 165 140 L 165 180"/></g><path d="M 150 82 A 5 5 0 0 1 150 92 A 6 6 0 1 0 150 80 Z" fill="%23ecfdf5"/><g fill="%23a7f3d0"><circle cx="150" cy="74" r="3"/><circle cx="132" cy="78" r="3"/><circle cx="168" cy="78" r="3"/><circle cx="116" cy="88" r="3"/><circle cx="184" cy="88" r="3"/><circle cx="104" cy="104" r="3"/><circle cx="196" cy="104" r="3"/><circle cx="98" cy="124" r="3"/><circle cx="202" cy="124" r="3"/></g><path id="arc-top" d="M 35 150 A 115 115 0 1 1 265 150" fill="none"/><path id="arc-bottom" d="M 265 150 A 115 115 0 0 1 35 150" fill="none"/><text fill="white" font-family="sans-serif" font-weight="900" font-size="14.5" letter-spacing="1"><textPath href="%23arc-top" startOffset="50%" text-anchor="middle">★ KELOMPOK KERJA GURU ★</textPath></text><text fill="white" font-family="sans-serif" font-weight="bold" font-size="16" x="150" y="52" text-anchor="middle">KKG PAI SD</text><text fill="white" font-family="sans-serif" font-weight="bold" font-size="11.5" x="150" y="215" text-anchor="middle">KECAMATAN CIMAHI SELATAN</text><text fill="white" font-family="sans-serif" font-weight="900" font-size="12" letter-spacing="0.5"><textPath href="%23arc-bottom" startOffset="50%" text-anchor="middle">PENDIDIKAN AGAMA ISLAM SEKOLAH DASAR</textPath></text></svg>`;

// Perkecil foto di HP sebelum diunggah (foto kamera bisa 5 MB lebih): sisi terpanjang 600px, JPEG
async function kecilkanFoto(file, sisiMaks = 600) {
    if (!file.type.startsWith('image/')) throw new Error('Berkas harus berupa gambar.');
    const gambar = await createImageBitmap(file);
    const skala = Math.min(1, sisiMaks / Math.max(gambar.width, gambar.height));
    const kanvas = document.createElement('canvas');
    kanvas.width = Math.round(gambar.width * skala);
    kanvas.height = Math.round(gambar.height * skala);
    kanvas.getContext('2d').drawImage(gambar, 0, 0, kanvas.width, kanvas.height);
    return new Promise((ok, gagal) => kanvas.toBlob(b => b ? ok(b) : gagal(new Error('Gagal memproses foto.')), 'image/jpeg', 0.85));
}

function namaFotoAcak(folder) {
    return `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
}

// Urutan alfabet nama; gelar di depan (H., Hj., Drs., Dra., Dr., Ust.) diabaikan agar "H. Abdullah" ada di huruf A
function kunciNama(nama) {
    return nama.trim().replace(/^((hj?|drs?|dra|ust|ustadz|ustadzah|kh|prof|ir)\.?\s+)+/i, '');
}

function urutNama(a, b) {
    return kunciNama(a.nama).localeCompare(kunciNama(b.nama), 'id', { sensitivity: 'base' });
}
