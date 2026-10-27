const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- Umum ----------

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function publicUrl(bucket, path) {
    return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function tanggalIndo(iso, pendek) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', pendek
        ? { day: '2-digit', month: 'short' }
        : { day: '2-digit', month: 'long', year: 'numeric' });
}

function hariIni() {
    return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, zona waktu perangkat
}

function pesanKosong(teks) {
    return `<p class="col-span-full text-center text-sm text-slate-400 py-6">${escapeHtml(teks)}</p>`;
}

function setupLogo() {
    const logoSvg = DEFAULT_LOGO;
    document.getElementById('kkg-logo').src = logoSvg;
    document.getElementById('footer-logo').src = logoSvg;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    const target = document.getElementById('sec-' + tabName);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-emerald-700', 'bg-emerald-50');
        btn.classList.add('text-slate-600');
    });
    const activeBtn = document.getElementById('nav-' + tabName);
    if (activeBtn) {
        activeBtn.classList.add('text-emerald-700', 'bg-emerald-50');
        activeBtn.classList.remove('text-slate-600');
    }

    document.getElementById('mobile-menu').classList.add('hidden');
    document.getElementById('mobile-menu-btn').setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3500);
}

// ---------- Beranda ----------

async function loadRekap() {
    const { data, error } = await db.rpc('rekap_beranda');
    if (error) {
        console.error(error);
        return;
    }
    document.getElementById('stat-gpai').innerText = data.gpai;
    document.getElementById('stat-kelurahan').innerText = data.kelurahan;
    document.getElementById('stat-gugus').innerText = data.gugus;
    document.getElementById('stat-sekolah').innerText = data.sekolah;
}

// Kontak, profil, dan daftar gugus/kelurahan diatur pengurus di admin
async function loadPengaturan() {
    const { data, error } = await db.from('pengaturan').select('*').eq('id', 1).single();
    if (error) {
        console.error(error);
        return;
    }
    document.getElementById('kontak-alamat').innerText = data.alamat;
    document.getElementById('profil-teks').innerText = data.profil || 'Profil organisasi belum diisi pengurus.';
    isiDaftar(data.daftar_kelurahan, data.daftar_gugus);
    document.getElementById('filter-jenis').innerHTML = '<option value="">Semua Jenis</option>' +
        data.daftar_jenis_perangkat.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    if (data.logo_path) {
        const logo = publicUrl('dokumentasi', data.logo_path);
        document.getElementById('kkg-logo').src = logo;
        document.getElementById('footer-logo').src = logo;
    }

    if (data.email) {
        const a = document.getElementById('kontak-email');
        a.innerText = data.email;
        a.href = 'mailto:' + data.email;
        document.getElementById('baris-email').classList.remove('hidden');
    }
    if (data.telepon) {
        const a = document.getElementById('kontak-telepon');
        a.innerText = data.telepon;
        a.href = 'tel:' + data.telepon.replace(/[^\d+]/g, '');
        document.getElementById('baris-telepon').classList.remove('hidden');
    }
    ['facebook', 'youtube', 'instagram'].forEach(nama => {
        if (!data[nama]) return;
        const a = document.getElementById('sosmed-' + nama);
        a.href = data[nama];
        a.classList.remove('hidden');
        a.classList.add('flex');
    });
}

function isiDaftar(kelurahan, gugus) {
    const opsi = list => list.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    document.getElementById('add-kelurahan').innerHTML = opsi(kelurahan);
    document.getElementById('add-gugus').innerHTML = opsi(gugus);
    document.getElementById('pres-gugus').innerHTML = '<option value="">Pilih gugus</option>' + opsi(gugus);
    document.getElementById('grid-kelurahan').innerHTML = kelurahan.map(k => `
        <div class="bg-emerald-800/60 p-4 rounded-xl border border-emerald-700 text-center">
            <i class="fa-solid fa-building-columns text-amber-400 mb-2 text-xl"></i>
            <h4 class="font-semibold text-sm">${escapeHtml(k)}</h4>
        </div>`).join('');
}

// ---------- Pendaftaran anggota ----------

function openModalTambahAnggota() {
    document.getElementById('modal-anggota').classList.remove('hidden');
}

function closeModalTambahAnggota() {
    document.getElementById('modal-anggota').classList.add('hidden');
}

async function submitAnggotaBaru(e) {
    e.preventDefault();
    const row = {
        nama: document.getElementById('add-nama').value,
        nip: document.getElementById('add-nip').value || '-',
        sekolah: document.getElementById('add-sekolah').value,
        kelurahan: document.getElementById('add-kelurahan').value,
        gugus: document.getElementById('add-gugus').value,
        status: document.getElementById('add-status').value,
        sertifikasi: document.getElementById('add-sertifikasi').value
    };

    const { error } = await db.from('anggota').insert(row);
    if (error) {
        console.error(error);
        showToast('Gagal menyimpan data anggota.');
        return;
    }
    closeModalTambahAnggota();
    document.getElementById('form-tambah-anggota').reset();
    showToast('Pendaftaran terkirim. Data masuk setelah disetujui pengurus.');
}

// ---------- Profil & pengurus ----------

async function loadPengurus() {
    const grid = document.getElementById('grid-pengurus');
    const { data, error } = await db.from('pengurus').select('*').order('urutan').order('id');
    if (error) {
        console.error(error);
        grid.innerHTML = pesanKosong('Gagal memuat susunan pengurus.');
        return;
    }
    if (data.length === 0) {
        grid.innerHTML = pesanKosong('Susunan pengurus belum diisi.');
        return;
    }
    grid.innerHTML = data.map(item => {
        const inisial = item.nama.trim().split(/\s+/).slice(0, 2).map(k => k[0]).join('').toUpperCase();
        const foto = item.foto_path
            ? `<img src="${escapeHtml(publicUrl('dokumentasi', item.foto_path))}" alt="${escapeHtml(item.nama)}" class="w-16 h-16 rounded-full object-cover shrink-0">`
            : `<div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xl flex items-center justify-center shrink-0">${escapeHtml(inisial)}</div>`;
        return `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
                ${foto}
                <div class="min-w-0">
                    <div class="font-bold text-slate-800 break-words">${escapeHtml(item.nama)}</div>
                    <div class="text-sm text-emerald-700 font-medium">${escapeHtml(item.jabatan)}</div>
                </div>
            </div>`;
    }).join('');
}

// ---------- Perangkat ajar ----------

let dataPerangkat = [];

async function loadPerangkat() {
    const { data, error } = await db.from('perangkat_ajar').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        document.getElementById('list-perangkat').innerHTML = pesanKosong('Gagal memuat perangkat ajar.');
        return;
    }
    dataPerangkat = data;
    renderPerangkat();
}

function renderPerangkat() {
    const cari = document.getElementById('cari-perangkat').value.toLowerCase();
    const jenis = document.getElementById('filter-jenis').value;
    const list = document.getElementById('list-perangkat');

    const hasil = dataPerangkat.filter(i =>
        (jenis === '' || i.jenis === jenis) && i.judul.toLowerCase().includes(cari));

    if (hasil.length === 0) {
        list.innerHTML = pesanKosong(dataPerangkat.length === 0 ? 'Belum ada perangkat ajar.' : 'Perangkat ajar tidak ditemukan.');
        return;
    }
    list.innerHTML = hasil.map(i => {
        const href = i.url || publicUrl('perangkat-ajar', i.file_path);
        return `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
                <div class="flex flex-wrap gap-2 mb-3">
                    <span class="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md">${escapeHtml(i.jenis)}</span>
                    <span class="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">Kelas ${escapeHtml(i.kelas)}</span>
                </div>
                <h3 class="font-bold text-slate-800 break-words">${escapeHtml(i.judul)}</h3>
                <p class="text-sm text-slate-600 mt-2 flex-1">${escapeHtml(i.deskripsi || '')}</p>
                <a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="mt-4 h-11 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition">
                    <i class="fa-solid ${i.url ? 'fa-arrow-up-right-from-square' : 'fa-download'} mr-2"></i>${i.url ? 'Buka Tautan' : 'Unduh Berkas'}
                </a>
            </div>`;
    }).join('');
}

// ---------- Agenda & presensi ----------

async function loadAgenda() {
    const list = document.getElementById('agenda-list');
    const { data, error } = await db.from('agenda').select('*').order('tanggal', { ascending: false });
    if (error) {
        console.error(error);
        list.innerHTML = pesanKosong('Gagal memuat agenda.');
        return;
    }
    if (data.length === 0) {
        list.innerHTML = pesanKosong('Belum ada agenda kegiatan.');
    } else {
        const hari = hariIni();
        const akan = data.filter(a => a.tanggal >= hari).reverse();
        const lalu = data.filter(a => a.tanggal < hari);
        list.innerHTML = [...akan, ...lalu].map(a => kartuAgenda(a, a.tanggal < hari)).join('');
    }

    // Kegiatan yang sedang membuka presensi
    const buka = data.filter(a => a.presensi_buka);
    const select = document.getElementById('pres-agenda');
    select.innerHTML = buka.map(a => `<option value="${a.id}">${escapeHtml(a.judul)} (${tanggalIndo(a.tanggal, true)})</option>`).join('');
    document.getElementById('form-presensi').classList.toggle('hidden', buka.length === 0);
    document.getElementById('presensi-kosong').classList.toggle('hidden', buka.length > 0);
}

function kartuAgenda(a, lewat) {
    const [tgl, bln] = tanggalIndo(a.tanggal, true).split(' ');
    return `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex gap-4 ${lewat ? 'opacity-60' : ''}">
            <div class="w-14 shrink-0 text-center rounded-xl bg-emerald-50 text-emerald-800 py-2 self-start">
                <div class="text-xl font-extrabold leading-none">${escapeHtml(tgl)}</div>
                <div class="text-xs font-semibold uppercase mt-1">${escapeHtml(bln)}</div>
            </div>
            <div class="min-w-0 flex-1">
                <span class="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">${escapeHtml(a.kategori)}</span>
                <h4 class="font-bold text-slate-800 mt-2 break-words">${escapeHtml(a.judul)}</h4>
                <p class="text-xs text-slate-500 mt-1"><i class="fa-regular fa-clock mr-1"></i>${escapeHtml(a.waktu || 'Waktu menyusul')} • <i class="fa-solid fa-location-dot mr-1"></i>${escapeHtml(a.lokasi)}</p>
                ${a.deskripsi ? `<p class="text-sm text-slate-600 mt-2">${escapeHtml(a.deskripsi)}</p>` : ''}
                ${a.presensi_buka ? `<button onclick="bukaPresensi(${a.id})" class="mt-3 h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold"><i class="fa-solid fa-clipboard-check mr-2"></i>Isi Presensi</button>` : ''}
            </div>
        </div>`;
}

function bukaPresensi(id) {
    switchTab('presensi');
    document.getElementById('pres-agenda').value = id;
}

async function handlePresensi(e) {
    e.preventDefault();
    const row = {
        agenda_id: Number(document.getElementById('pres-agenda').value),
        nama: document.getElementById('pres-nama').value.trim(),
        sekolah: document.getElementById('pres-sekolah').value.trim(),
        gugus: document.getElementById('pres-gugus').value
    };

    const { error } = await db.from('presensi').insert(row);
    if (error) {
        console.error(error);
        if (error.code === '23505') showToast('Kamu sudah tercatat hadir di kegiatan ini.');
        else if (error.code === '42501') showToast('Presensi untuk kegiatan ini sudah ditutup.');
        else showToast('Gagal mengirim kehadiran.');
        return;
    }
    document.getElementById('pres-nama').value = '';
    document.getElementById('pres-sekolah').value = '';
    document.getElementById('pres-gugus').value = '';
    showToast('Kehadiran tercatat. Terima kasih!');
}

// ---------- Galeri & informasi ----------

async function loadInformasi() {
    const list = document.getElementById('info-list');
    const { data, error } = await db.from('informasi').select('*').order('tanggal', { ascending: false }).order('id', { ascending: false }).limit(20);
    if (error) {
        console.error(error);
        list.innerHTML = pesanKosong('Gagal memuat informasi.');
        return;
    }
    if (data.length === 0) {
        list.innerHTML = pesanKosong('Belum ada informasi.');
        return;
    }
    list.innerHTML = data.map(i => `
        <article class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p class="text-xs text-slate-500"><i class="fa-regular fa-calendar mr-1"></i>${tanggalIndo(i.tanggal)}</p>
            <h4 class="font-bold text-slate-800 mt-1 break-words">${escapeHtml(i.judul)}</h4>
            <p class="text-sm text-slate-600 mt-2 whitespace-pre-line break-words">${escapeHtml(i.isi)}</p>
        </article>`).join('');
}

async function loadDokumentasi() {
    const grid = document.getElementById('galeri-grid');
    const { data, error } = await db.from('dokumentasi').select('*').order('tanggal', { ascending: false });
    if (error) {
        console.error(error);
        grid.innerHTML = pesanKosong('Gagal memuat dokumentasi.');
        return;
    }
    if (data.length === 0) {
        grid.innerHTML = pesanKosong('Belum ada dokumentasi.');
        return;
    }

    grid.innerHTML = data.map(item => {
        const src = item.foto_url || publicUrl('dokumentasi', item.foto_path);
        return `
            <div class="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 hover:shadow-xl transition">
                <img src="${escapeHtml(src)}" alt="${escapeHtml(item.judul)}" loading="lazy" class="w-full h-48 object-cover">
                <div class="p-5">
                    <span class="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md">${escapeHtml(item.kategori)}</span>
                    <h3 class="font-bold text-slate-800 mt-3 mb-2">${escapeHtml(item.judul)}</h3>
                    <p class="text-xs text-slate-500 mb-3"><i class="fa-regular fa-calendar mr-1"></i> ${tanggalIndo(item.tanggal)} • ${escapeHtml(item.lokasi)}</p>
                    <p class="text-sm text-slate-600">${escapeHtml(item.deskripsi || '')}</p>
                </div>
            </div>`;
    }).join('');
}

// ---------- Masukan & saran ----------

async function handleAspirasi(e) {
    e.preventDefault();
    const form = document.getElementById('form-aspirasi');
    const fields = form.querySelectorAll('input, select, textarea');
    const row = {
        nama: fields[0].value,
        sekolah: fields[1].value,
        kategori: fields[2].value,
        pesan: fields[3].value
    };

    const { error } = await db.from('aspirasi').insert(row);
    if (error) {
        console.error(error);
        showToast('Gagal mengirim masukan.');
        return;
    }
    form.reset();
    showToast('Masukan Anda berhasil dikirim. Terima kasih!');
}

// ---------- Mulai ----------

document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
    document.getElementById('mobile-menu-btn').setAttribute('aria-expanded', String(!menu.classList.contains('hidden')));
});

window.onload = function() {
    setupLogo();
    loadRekap();
    loadPengaturan();
    loadPengurus();
    loadPerangkat();
    loadAgenda();
    loadInformasi();
    loadDokumentasi();
};
