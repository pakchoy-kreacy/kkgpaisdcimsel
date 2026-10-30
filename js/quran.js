// Al-Qur'an: data dari equran.id (teks Arab, latin, terjemahan Kemenag, audio per ayat).
// Teks dari API ditampilkan lewat escapeHtml; deskripsi surat (berisi HTML) sengaja tidak dipakai.

const QURAN_API = 'https://equran.id/api/v2';
const FONT_ARAB = "font-family: 'Scheherazade New', serif";
let daftarSurat = [];
let suratAktif = null;
let ayatDiputar = null;

function simpanTerakhir(nomorSurat, nomorAyat) {
    try {
        localStorage.setItem('quran-terakhir', JSON.stringify({ surat: nomorSurat, ayat: nomorAyat }));
    } catch (e) { /* penyimpanan browser tidak tersedia; abaikan */ }
}

function bacaTerakhir() {
    try {
        return JSON.parse(localStorage.getItem('quran-terakhir'));
    } catch (e) {
        return null;
    }
}

async function muatDaftarSurat() {
    if (daftarSurat.length) return;
    const list = document.getElementById('quran-list');
    list.innerHTML = pesanKosong('Memuat daftar surat...');
    try {
        const res = await fetch(`${QURAN_API}/surat`);
        daftarSurat = (await res.json()).data;
    } catch (err) {
        console.error(err);
        list.innerHTML = pesanKosong('Daftar surat gagal dimuat. Periksa koneksi internet lalu buka menu ini lagi.');
        return;
    }
    renderDaftarSurat();
    tampilkanLanjutkan();
}

function tampilkanLanjutkan() {
    const t = bacaTerakhir();
    const s = t && daftarSurat.find(x => x.nomor === t.surat);
    const btn = document.getElementById('quran-lanjut');
    btn.classList.toggle('hidden', !s);
    if (!s) return;
    document.getElementById('quran-lanjut-teks').innerText = `${s.namaLatin}, ayat ${t.ayat}`;
    btn.onclick = () => bukaSurat(s.nomor, t.ayat);
}

function renderDaftarSurat() {
    const q = document.getElementById('quran-cari').value.trim().toLowerCase().replace(/[-'\s]/g, '');
    const hasil = daftarSurat.filter(s =>
        !q || String(s.nomor) === q || s.namaLatin.toLowerCase().replace(/[-'\s]/g, '').includes(q) || s.arti.toLowerCase().includes(q));
    document.getElementById('quran-list').innerHTML = hasil.length ? hasil.map(s => `
        <button type="button" onclick="bukaSurat(${s.nomor})" class="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-emerald-400">
            <span class="w-11 h-11 shrink-0 rounded-xl bg-emerald-50 text-emerald-800 font-bold flex items-center justify-center">${s.nomor}</span>
            <span class="min-w-0 flex-1">
                <span class="block font-bold text-slate-800">${escapeHtml(s.namaLatin)}</span>
                <span class="block text-xs text-slate-500">${escapeHtml(s.arti)} • ${s.jumlahAyat} ayat • ${escapeHtml(s.tempatTurun)}</span>
            </span>
            <span class="text-2xl text-emerald-900 shrink-0" dir="rtl" style="${FONT_ARAB}">${escapeHtml(s.nama)}</span>
        </button>`).join('') : pesanKosong('Surat tidak ditemukan.');
}

async function bukaSurat(nomor, keAyat) {
    hentikanAudio();
    document.getElementById('quran-daftar').classList.add('hidden');
    document.getElementById('quran-baca').classList.remove('hidden');
    const wadah = document.getElementById('baca-ayat');
    wadah.innerHTML = pesanKosong('Memuat surat...');
    window.scrollTo({ top: document.getElementById('sec-quran').offsetTop - 80 });

    try {
        const res = await fetch(`${QURAN_API}/surat/${nomor}`);
        suratAktif = (await res.json()).data;
    } catch (err) {
        console.error(err);
        wadah.innerHTML = pesanKosong('Surat gagal dimuat. Periksa koneksi internet lalu coba lagi.');
        return;
    }
    const s = suratAktif;
    document.getElementById('baca-arab-nama').innerText = s.nama;
    document.getElementById('baca-judul').innerText = `${s.nomor}. ${s.namaLatin}`;
    document.getElementById('baca-info').innerText = `${s.arti} • ${s.jumlahAyat} ayat • ${s.tempatTurun}`;
    document.getElementById('lompat-ayat').max = s.jumlahAyat;
    // Al-Fatihah sudah memuat basmalah sebagai ayat 1; At-Taubah tanpa basmalah
    document.getElementById('baca-bismillah').classList.toggle('hidden', s.nomor === 1 || s.nomor === 9);

    wadah.innerHTML = s.ayat.map(a => `
        <div id="ayat-${a.nomorAyat}" class="ayat py-6 scroll-mt-40 transition-colors rounded-xl">
            <div class="flex items-center justify-between gap-3">
                <span class="w-10 h-10 rounded-full border-2 border-emerald-600 text-emerald-700 text-sm font-bold flex items-center justify-center">${a.nomorAyat}</span>
                <button type="button" onclick="putarDariAyat(${a.nomorAyat})" aria-label="Putar ayat ${a.nomorAyat}" class="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700"><i class="fa-solid fa-play"></i></button>
            </div>
            <p class="text-right text-3xl leading-[2.4] text-slate-900 mt-3" dir="rtl" lang="ar" style="${FONT_ARAB}">${escapeHtml(a.teksArab)}</p>
            <p class="teks-latin text-emerald-800 italic mt-3">${escapeHtml(a.teksLatin)}</p>
            <p class="teks-arti text-slate-600 mt-2">${escapeHtml(a.teksIndonesia)}</p>
        </div>`).join('');
    aturTampilan();

    const sebelum = s.suratSebelumnya;
    const berikut = s.suratSelanjutnya;
    const btnSebelum = document.getElementById('btn-surat-sebelum');
    const btnBerikut = document.getElementById('btn-surat-berikut');
    btnSebelum.classList.toggle('invisible', !sebelum);
    btnBerikut.classList.toggle('invisible', !berikut);
    if (sebelum) { btnSebelum.innerHTML = `<i class="fa-solid fa-chevron-left mr-2"></i>${escapeHtml(sebelum.namaLatin)}`; btnSebelum.onclick = () => bukaSurat(sebelum.nomor); }
    if (berikut) { btnBerikut.innerHTML = `${escapeHtml(berikut.namaLatin)}<i class="fa-solid fa-chevron-right ml-2"></i>`; btnBerikut.onclick = () => bukaSurat(berikut.nomor); }

    if (keAyat) document.getElementById('ayat-' + keAyat)?.scrollIntoView({ behavior: 'smooth' });
    simpanTerakhir(s.nomor, keAyat || 1);
}

function tutupSurat() {
    hentikanAudio();
    document.getElementById('quran-baca').classList.add('hidden');
    document.getElementById('quran-daftar').classList.remove('hidden');
    tampilkanLanjutkan();
}

function aturTampilan() {
    const latin = document.getElementById('tampil-latin').checked;
    const arti = document.getElementById('tampil-arti').checked;
    document.querySelectorAll('.teks-latin').forEach(el => el.classList.toggle('hidden', !latin));
    document.querySelectorAll('.teks-arti').forEach(el => el.classList.toggle('hidden', !arti));
}

function lompatAyat(e) {
    e.preventDefault();
    const n = Number(document.getElementById('lompat-ayat').value);
    const el = document.getElementById('ayat-' + n);
    if (!el) return showToast(`Ayat ${n} tidak ada di surat ini.`);
    el.scrollIntoView({ behavior: 'smooth' });
    simpanTerakhir(suratAktif.nomor, n);
}

// Murottal: putar dari ayat tertentu lalu lanjut berurutan sampai akhir surat
function putarDariAyat(nomor) {
    if (!suratAktif) return;
    const ayat = suratAktif.ayat.find(a => a.nomorAyat === nomor);
    if (!ayat) return hentikanAudio();
    const audio = document.getElementById('quran-audio');
    ayatDiputar = nomor;
    audio.src = ayat.audio[document.getElementById('quran-qari').value];
    audio.play().catch(err => {
        console.error(err);
        showToast('Audio gagal diputar. Periksa koneksi internet.');
        hentikanAudio();
    });
    document.querySelectorAll('.ayat').forEach(el => el.classList.remove('bg-emerald-50'));
    const el = document.getElementById('ayat-' + nomor);
    el.classList.add('bg-emerald-50');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('btn-stop').classList.remove('hidden');
    simpanTerakhir(suratAktif.nomor, nomor);
}

function hentikanAudio() {
    const audio = document.getElementById('quran-audio');
    audio.pause();
    ayatDiputar = null;
    document.querySelectorAll('.ayat').forEach(el => el.classList.remove('bg-emerald-50'));
    document.getElementById('btn-stop').classList.add('hidden');
}

function gantiQari() {
    if (ayatDiputar) putarDariAyat(ayatDiputar);
}

document.getElementById('quran-audio').addEventListener('ended', () => {
    if (ayatDiputar && ayatDiputar < suratAktif.jumlahAyat) putarDariAyat(ayatDiputar + 1);
    else hentikanAudio();
});

// Muat daftar surat saat menu Al-Qur'an pertama kali dibuka; hentikan audio saat pindah menu
const switchTabAsli = switchTab;
switchTab = function (tabName) {
    if (tabName !== 'quran') hentikanAudio();
    switchTabAsli(tabName);
    if (tabName === 'quran') muatDaftarSurat();
};
