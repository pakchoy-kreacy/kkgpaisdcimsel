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
    if (data.hero_path) {
        document.querySelector('.hero-bg').style.setProperty('--hero-gambar', `url("${publicUrl('dokumentasi', data.hero_path)}")`);
    }
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

const pilihan = { kelurahan: [], gugus: [] };

function isiDaftar(kelurahan, gugus) {
    pilihan.kelurahan = kelurahan;
    pilihan.gugus = gugus;
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

document.getElementById('add-foto').addEventListener('change', e => {
    const file = e.target.files[0];
    const preview = document.getElementById('add-foto-preview');
    preview.classList.toggle('hidden', !file);
    if (file) preview.src = URL.createObjectURL(file);
});

async function submitAnggotaBaru(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-simpan-anggota');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerText = 'Mengirim...';
    try {
        await kirimPendaftaran();
    } finally {
        btn.disabled = false;
        btn.innerHTML = label;
    }
}

async function kirimPendaftaran() {
    // Foto tidak wajib; diunggah dulu karena pendaftar tidak bisa mengubah data setelah terkirim
    let foto_path = null;
    const file = document.getElementById('add-foto').files[0];
    if (file) {
        try {
            const foto = await kecilkanFoto(file);
            foto_path = namaFotoAcak('daftar');
            const { error } = await db.storage.from('foto-anggota').upload(foto_path, foto, { contentType: 'image/jpeg' });
            if (error) throw error;
        } catch (err) {
            console.error(err);
            showToast('Foto gagal diunggah. Coba foto lain, atau kirim tanpa foto.');
            return;
        }
    }

    const row = {
        nama: document.getElementById('add-nama').value,
        nip: document.getElementById('add-nip').value || '-',
        sekolah: document.getElementById('add-sekolah').value,
        kelurahan: document.getElementById('add-kelurahan').value,
        gugus: document.getElementById('add-gugus').value,
        status: document.getElementById('add-status').value,
        sertifikasi: document.getElementById('add-sertifikasi').value,
        foto_path
    };

    const { error } = await db.from('anggota').insert(row);
    if (error) {
        console.error(error);
        showToast('Gagal menyimpan data anggota.');
        return;
    }
    closeModalTambahAnggota();
    document.getElementById('form-tambah-anggota').reset();
    document.getElementById('add-foto-preview').classList.add('hidden');
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

// ---------- Anggota KKG (tanpa NIP, lewat fungsi daftar_anggota_publik_v3) ----------

let dataAnggota = [];

async function loadAnggota() {
    const { data, error } = await db.rpc('daftar_anggota_publik_v3');
    if (error) {
        console.error(error);
        document.getElementById('list-anggota').innerHTML = pesanKosong('Gagal memuat anggota.');
        return;
    }
    dataAnggota = data.sort(urutNama);
    const gugus = [...new Set(data.map(a => a.gugus))].sort();
    document.getElementById('filter-gugus-anggota').innerHTML = '<option value="">Semua Gugus</option>' +
        gugus.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
    renderAnggota(1);
    renderRekapAnggota();
}

// ---------- Rekap beranda: status kepegawaian & sertifikasi ----------

const URUTAN_STATUS = ['PNS', 'PPPK', 'Non ASN Sekolah Negeri', 'Non ASN Sekolah Swasta', 'GTT', 'GTY'];

function barisRekap(label, jumlah, total, warna) {
    const persen = total ? Math.round(jumlah / total * 100) : 0;
    return `
        <div>
            <div class="flex justify-between items-baseline gap-3 text-sm">
                <span class="text-slate-700">${escapeHtml(label)}</span>
                <span><b class="text-slate-900">${jumlah}</b> <span class="text-slate-400 text-xs">(${persen}%)</span></span>
            </div>
            <div class="mt-1 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full ${warna}" style="width:${persen}%"></div></div>
        </div>`;
}

function renderRekapAnggota() {
    const total = dataAnggota.length;
    const hitung = (kolom, nilai) => dataAnggota.filter(a => a[kolom] === nilai).length;
    // status di luar daftar baku tetap ikut dihitung
    const status = [...URUTAN_STATUS, ...new Set(dataAnggota.map(a => a.status).filter(st => !URUTAN_STATUS.includes(st)))];
    document.getElementById('rekap-status').innerHTML = total
        ? status.map(st => barisRekap(st, hitung('status', st), total, 'bg-emerald-500')).join('')
        : '<p class="text-sm text-slate-400">Belum ada data anggota.</p>';
    document.getElementById('rekap-sertifikasi').innerHTML = total
        ? barisRekap('Sudah sertifikasi', hitung('sertifikasi', 'Sudah'), total, 'bg-emerald-500') +
          barisRekap('Belum sertifikasi', hitung('sertifikasi', 'Belum'), total, 'bg-amber-400')
        : '<p class="text-sm text-slate-400">Belum ada data anggota.</p>';
}

function badgeStatus(status) {
    if (status === 'PNS') return 'bg-emerald-100 text-emerald-800';
    if (status === 'PPPK') return 'bg-blue-100 text-blue-800';
    if (status.includes('Non ASN')) return 'bg-purple-100 text-purple-800';
    return 'bg-amber-100 text-amber-800';
}

function badgeSertifikasi(nilai) {
    return nilai === 'Sudah' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600';
}

function avatarAnggota(a, ukuran) {
    if (a.foto_path) {
        return `<img src="${escapeHtml(publicUrl('foto-anggota', a.foto_path))}" alt="" loading="lazy" class="${ukuran} rounded-full object-cover shrink-0 bg-slate-100">`;
    }
    const inisial = a.nama.trim().split(/\s+/).slice(0, 2).map(k => k[0]).join('').toUpperCase();
    return `<div class="${ukuran} rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">${escapeHtml(inisial)}</div>`;
}

const PER_HALAMAN = 25;
let halamanAnggota = 1;

function renderAnggota(halaman = halamanAnggota) {
    const cari = document.getElementById('cari-anggota').value.toLowerCase();
    const gugus = document.getElementById('filter-gugus-anggota').value;
    const hasil = dataAnggota.filter(a =>
        (gugus === '' || a.gugus === gugus) &&
        (a.nama.toLowerCase().includes(cari) || a.sekolah.toLowerCase().includes(cari)));

    const jumlahHalaman = Math.max(1, Math.ceil(hasil.length / PER_HALAMAN));
    halamanAnggota = Math.min(Math.max(1, halaman), jumlahHalaman);
    const awal = (halamanAnggota - 1) * PER_HALAMAN;
    const tampil = hasil.slice(awal, awal + PER_HALAMAN);

    document.getElementById('anggota-jumlah').innerText = hasil.length > PER_HALAMAN
        ? `Menampilkan ${awal + 1}–${awal + tampil.length} dari ${hasil.length} anggota`
        : `${hasil.length} anggota`;
    renderPager(jumlahHalaman);
    const kosong = dataAnggota.length === 0 ? 'Belum ada anggota yang terdaftar.' : 'Anggota tidak ditemukan.';
    const badge = (cls, teks) => `<span class="px-2.5 py-1 ${cls} rounded-full text-xs font-bold whitespace-nowrap">${escapeHtml(teks)}</span>`;

    document.getElementById('list-anggota').innerHTML = hasil.length ? tampil.map((a, i) => `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div class="flex items-start gap-3">
                <span class="text-xs text-slate-400 w-6 shrink-0 pt-4 text-right">${awal + i + 1}</span>
                ${avatarAnggota(a, 'w-12 h-12')}
                <div class="font-bold text-slate-800 break-words min-w-0 flex-1 self-center">${escapeHtml(a.nama)}</div>
                ${badge(badgeStatus(a.status), a.status)}
            </div>
            <div class="mt-2 text-sm text-slate-700 font-medium">${escapeHtml(a.sekolah)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(a.kelurahan)} • ${escapeHtml(a.gugus)}</div>
            <div class="mt-3 flex items-center justify-between gap-3">
                ${badge(badgeSertifikasi(a.sertifikasi), 'Sertifikasi: ' + a.sertifikasi)}
                <button onclick="openModalUsulan(${a.id})" class="h-11 px-4 rounded-xl border border-emerald-600 text-emerald-700 text-sm font-bold"><i class="fa-solid fa-pen mr-2"></i>Edit</button>
            </div>
        </div>`).join('') : pesanKosong(kosong);

    document.getElementById('tabel-anggota').innerHTML = hasil.length ? tampil.map((a, i) => `
        <tr class="border-b border-slate-100">
            <td class="p-4">${awal + i + 1}</td>
            <td class="p-4 font-bold text-slate-800"><div class="flex items-center gap-3">${avatarAnggota(a, 'w-10 h-10')}<span>${escapeHtml(a.nama)}</span></div></td>
            <td class="p-4">${escapeHtml(a.sekolah)}</td>
            <td class="p-4">${escapeHtml(a.kelurahan)}</td>
            <td class="p-4">${escapeHtml(a.gugus)}</td>
            <td class="p-4">${badge(badgeStatus(a.status), a.status)}</td>
            <td class="p-4">${badge(badgeSertifikasi(a.sertifikasi), a.sertifikasi)}</td>
            <td class="p-4 text-right"><button onclick="openModalUsulan(${a.id})" class="h-11 px-4 rounded-xl border border-emerald-600 text-emerald-700 text-sm font-bold"><i class="fa-solid fa-pen mr-2"></i>Edit</button></td>
        </tr>`).join('') : `<tr><td colspan="8">${pesanKosong(kosong)}</td></tr>`;
}

function gantiHalamanAnggota(n) {
    renderAnggota(n);
    document.getElementById('anggota-jumlah').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Nomor halaman: selalu tampilkan halaman pertama, terakhir, dan dua di sekitar halaman aktif
function renderPager(jumlah) {
    const nav = document.getElementById('pager-anggota');
    if (jumlah <= 1) {
        nav.innerHTML = '';
        return;
    }
    const nomor = [];
    for (let n = 1; n <= jumlah; n++) {
        if (n === 1 || n === jumlah || Math.abs(n - halamanAnggota) <= 1) nomor.push(n);
        else if (nomor[nomor.length - 1] !== '…') nomor.push('…');
    }
    const tombol = (n, isi, label, aktif = false, mati = false) =>
        `<button ${mati ? 'disabled' : `onclick="gantiHalamanAnggota(${n})"`} aria-label="${label}" ${aktif ? 'aria-current="page"' : ''}
            class="min-w-11 h-11 px-3 rounded-xl text-sm font-semibold border ${aktif ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'} disabled:opacity-40">${isi}</button>`;
    nav.innerHTML =
        tombol(halamanAnggota - 1, '<i class="fa-solid fa-chevron-left"></i>', 'Halaman sebelumnya', false, halamanAnggota === 1) +
        nomor.map(n => n === '…' ? '<span class="px-1 text-slate-400">…</span>' : tombol(n, n, 'Halaman ' + n, n === halamanAnggota)).join('') +
        tombol(halamanAnggota + 1, '<i class="fa-solid fa-chevron-right"></i>', 'Halaman berikutnya', false, halamanAnggota === jumlah);
}

// ---------- Perbaikan data oleh anggota (usulan, diterapkan pengurus) ----------

let anggotaUsulan = null;

function isiPilihan(select, daftar, nilai) {
    const semua = daftar.includes(nilai) ? daftar : [nilai, ...daftar];
    select.innerHTML = semua.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    select.value = nilai;
}

function openModalUsulan(id) {
    const a = dataAnggota.find(x => x.id === id);
    if (!a) return;
    anggotaUsulan = a;
    document.getElementById('form-usulan').reset();
    document.getElementById('us-nama').value = a.nama;
    document.getElementById('us-sekolah').value = a.sekolah;
    isiPilihan(document.getElementById('us-kelurahan'), pilihan.kelurahan, a.kelurahan);
    isiPilihan(document.getElementById('us-gugus'), pilihan.gugus, a.gugus);
    document.getElementById('us-status').value = a.status;
    document.getElementById('us-sertifikasi').value = a.sertifikasi;
    const preview = document.getElementById('us-foto-preview');
    preview.src = a.foto_path ? publicUrl('foto-anggota', a.foto_path) : DEFAULT_LOGO;
    document.getElementById('modal-usulan').classList.remove('hidden');
}

function closeModalUsulan() {
    document.getElementById('modal-usulan').classList.add('hidden');
}

document.getElementById('us-foto').addEventListener('change', e => {
    if (e.target.files[0]) document.getElementById('us-foto-preview').src = URL.createObjectURL(e.target.files[0]);
});

async function submitUsulan(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-kirim-usulan');
    btn.disabled = true;
    btn.innerText = 'Mengirim...';
    try {
        let foto_path = null;
        const file = document.getElementById('us-foto').files[0];
        if (file) {
            try {
                const foto = await kecilkanFoto(file);
                foto_path = namaFotoAcak('daftar');
                const { error } = await db.storage.from('foto-anggota').upload(foto_path, foto, { contentType: 'image/jpeg' });
                if (error) throw error;
            } catch (err) {
                console.error(err);
                showToast('Foto gagal diunggah. Coba foto lain, atau kirim tanpa foto.');
                return;
            }
        }
        const { error } = await db.from('usulan_anggota').insert({
            anggota_id: anggotaUsulan.id,
            nama: document.getElementById('us-nama').value.trim(),
            nip: document.getElementById('us-nip').value.trim() || null,
            sekolah: document.getElementById('us-sekolah').value.trim(),
            kelurahan: document.getElementById('us-kelurahan').value,
            gugus: document.getElementById('us-gugus').value,
            status: document.getElementById('us-status').value,
            sertifikasi: document.getElementById('us-sertifikasi').value,
            foto_path,
            catatan: document.getElementById('us-catatan').value.trim() || null
        });
        if (error) {
            console.error(error);
            showToast('Gagal mengirim perbaikan.');
            return;
        }
        closeModalUsulan();
        showToast('Perbaikan terkirim. Tampil setelah diperiksa pengurus.');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Kirim Perbaikan';
    }
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

// ---------- Karya inovasi digital ----------

function idYoutube(url) {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
    return m ? m[1] : null;
}

async function loadKarya() {
    const list = document.getElementById('list-karya');
    const { data, error } = await db.from('karya').select('*').eq('disetujui', true).order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        list.innerHTML = pesanKosong('Gagal memuat karya.');
        return;
    }
    if (data.length === 0) {
        list.innerHTML = pesanKosong('Belum ada karya. Jadilah yang pertama mengirim!');
        return;
    }
    list.innerHTML = data.map(k => {
        const yt = idYoutube(k.url);
        const sampul = k.sampul_path ? publicUrl('dokumentasi', k.sampul_path) : (yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : null);
        const gambar = sampul
            ? `<img src="${escapeHtml(sampul)}" alt="${escapeHtml(k.judul)}" loading="lazy" class="w-full h-44 object-cover">`
            : `<div class="w-full h-44 bg-gradient-to-br from-indigo-500 to-emerald-600 flex items-center justify-center"><i class="fa-solid fa-lightbulb text-5xl text-white/80"></i></div>`;
        return `
            <div class="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 flex flex-col">
                ${gambar}
                <div class="p-5 flex flex-col flex-1">
                    <span class="self-start text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-md">${escapeHtml(k.jenis)}</span>
                    <h3 class="font-bold text-slate-800 mt-3 break-words">${escapeHtml(k.judul)}</h3>
                    <p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-user mr-1"></i>${escapeHtml(k.nama_guru)} • ${escapeHtml(k.sekolah)}</p>
                    <p class="text-sm text-slate-600 mt-2 flex-1">${escapeHtml(k.deskripsi || '')}</p>
                    <a href="${escapeHtml(k.url)}" target="_blank" rel="noopener" class="mt-4 h-11 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition">
                        <i class="fa-solid fa-arrow-up-right-from-square mr-2"></i>Lihat Karya
                    </a>
                </div>
            </div>`;
    }).join('');
}

function openModalKarya() {
    document.getElementById('modal-karya').classList.remove('hidden');
}

function closeModalKarya() {
    document.getElementById('modal-karya').classList.add('hidden');
}

async function submitKarya(e) {
    e.preventDefault();
    const row = {
        judul: document.getElementById('kr-judul').value.trim(),
        nama_guru: document.getElementById('kr-nama').value.trim(),
        sekolah: document.getElementById('kr-sekolah').value.trim(),
        jenis: document.getElementById('kr-jenis').value,
        url: document.getElementById('kr-url').value.trim(),
        deskripsi: document.getElementById('kr-deskripsi').value.trim() || null
    };
    const { error } = await db.from('karya').insert(row);
    if (error) {
        console.error(error);
        showToast('Gagal mengirim karya. Periksa tautannya (harus diawali https://).');
        return;
    }
    closeModalKarya();
    document.getElementById('form-karya').reset();
    showToast('Karya terkirim. Tampil setelah diperiksa pengurus.');
}

// ---------- Jadwal sholat (dihitung di perangkat, kriteria Kemenag) ----------

const LOKASI_SHOLAT = { lintang: -6.8985, bujur: 107.5450 }; // Kecamatan Cimahi Selatan
const ZONA = 'Asia/Jakarta';
const jamWIB = d => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: ZONA });
const hijriah = (d, opsi) => new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura-nu-latn', opsi).format(d);

function waktuSholat(tanggal) {
    const p = adhan.CalculationMethod.Other();
    p.fajrAngle = 20;
    p.ishaAngle = 18;
    p.madhab = adhan.Madhab.Shafi;
    p.adjustments = { fajr: 2, sunrise: -2, dhuhr: 2, asr: 2, maghrib: 2, isha: 2 }; // ihtiyat 2 menit
    return new adhan.PrayerTimes(new adhan.Coordinates(LOKASI_SHOLAT.lintang, LOKASI_SHOLAT.bujur), tanggal, p);
}

function renderSholat() {
    const list = document.getElementById('sholat-list');
    if (!window.adhan) {
        list.innerHTML = '<li class="py-3 text-sm text-slate-400">Jadwal sholat gagal dimuat. Periksa koneksi internet.</li>';
        return;
    }
    const sekarang = new Date();
    const t = waktuSholat(sekarang);
    const baris = [['Subuh', t.fajr], ['Terbit', t.sunrise], ['Dzuhur', t.dhuhr], ['Ashar', t.asr], ['Maghrib', t.maghrib], ['Isya', t.isha]];

    // Sholat berikutnya; setelah Isya, berikutnya Subuh besok
    let berikut = baris.find(([nama, w]) => nama !== 'Terbit' && w > sekarang);
    if (!berikut) {
        const besok = new Date(sekarang);
        besok.setDate(besok.getDate() + 1);
        berikut = ['Subuh', waktuSholat(besok).fajr];
    }
    const menit = Math.max(0, Math.round((berikut[1] - sekarang) / 60000));
    const sisa = menit >= 60 ? `${Math.floor(menit / 60)} jam ${menit % 60} menit` : `${menit} menit`;

    document.getElementById('sholat-tanggal').innerText =
        `${sekarang.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • ${hijriah(sekarang, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    document.getElementById('sholat-berikut').innerHTML = `<i class="fa-regular fa-clock mr-2"></i>Menuju ${berikut[0]}: ${sisa} lagi`;
    list.innerHTML = baris.map(([nama, w]) => {
        const aktif = nama === berikut[0] && w.getTime() === berikut[1].getTime();
        return `<li class="flex justify-between items-center py-2.5 ${aktif ? 'text-emerald-700 font-bold' : nama === 'Terbit' ? 'text-slate-400 text-sm' : 'text-slate-700'}">
            <span>${aktif ? '<i class="fa-solid fa-circle text-[8px] mr-2 align-middle"></i>' : ''}${nama}</span>
            <span class="tabular-nums">${jamWIB(w)}</span>
        </li>`;
    }).join('');
}

// ---------- Kalender kegiatan (Masehi + Hijriah, titik untuk hari ber-agenda) ----------

let dataAgenda = [];
let bulanKalender = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let tanggalDipilih = null;

function geserBulan(n) {
    bulanKalender = new Date(bulanKalender.getFullYear(), bulanKalender.getMonth() + n, 1);
    tanggalDipilih = null;
    renderKalender();
}

function pilihTanggal(iso) {
    tanggalDipilih = tanggalDipilih === iso ? null : iso;
    renderKalender();
}

function renderKalender() {
    const th = bulanKalender.getFullYear();
    const bl = bulanKalender.getMonth();
    const jumlahHari = new Date(th, bl + 1, 0).getDate();
    const hari = hariIni();
    const adaAgenda = new Set(dataAgenda.map(a => a.tanggal));

    document.getElementById('kal-judul').innerText = bulanKalender.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const hAwal = hijriah(new Date(th, bl, 1), { month: 'long', year: 'numeric' });
    const hAkhir = hijriah(new Date(th, bl, jumlahHari), { month: 'long', year: 'numeric' });
    document.getElementById('kal-hijriah').innerText = hAwal === hAkhir ? hAwal : `${hAwal.replace(/ \d+ H$/, '')} – ${hAkhir}`;

    let sel = '<div></div>'.repeat(new Date(th, bl, 1).getDay());
    for (let d = 1; d <= jumlahHari; d++) {
        const tgl = new Date(th, bl, d);
        const iso = tgl.toLocaleDateString('sv-SE');
        const hariKe = tgl.getDay();
        const dipilih = iso === tanggalDipilih;
        const warna = dipilih ? 'bg-emerald-600 text-white' : iso === hari ? 'ring-2 ring-emerald-500 text-emerald-800' : hariKe === 0 ? 'text-red-500' : hariKe === 5 ? 'text-emerald-700' : 'text-slate-700';
        sel += `<button type="button" onclick="pilihTanggal('${iso}')" aria-label="${tgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}${adaAgenda.has(iso) ? ', ada agenda' : ''}"
            class="relative min-h-12 rounded-lg flex flex-col items-center justify-center ${dipilih ? '' : 'hover:bg-emerald-50'} ${warna}">
            <span class="text-sm font-semibold leading-none">${d}</span>
            <span class="text-[10px] leading-none mt-1 ${dipilih ? 'text-emerald-100' : 'text-slate-400'}">${hijriah(tgl, { day: 'numeric' })}</span>
            ${adaAgenda.has(iso) ? `<span class="absolute bottom-1 w-1.5 h-1.5 rounded-full ${dipilih ? 'bg-white' : 'bg-amber-500'}"></span>` : ''}
        </button>`;
    }
    document.getElementById('kal-grid').innerHTML = sel;

    // Agenda pada tanggal dipilih, atau semua agenda bulan ini
    const awalBulan = new Date(th, bl, 1).toLocaleDateString('sv-SE');
    const akhirBulan = new Date(th, bl, jumlahHari).toLocaleDateString('sv-SE');
    const daftar = dataAgenda
        .filter(a => tanggalDipilih ? a.tanggal === tanggalDipilih : a.tanggal >= awalBulan && a.tanggal <= akhirBulan)
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const judul = tanggalDipilih
        ? new Date(tanggalDipilih + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'Agenda bulan ini';
    document.getElementById('kal-agenda').innerHTML = `<p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">${escapeHtml(judul)}</p>` +
        (daftar.length ? daftar.map(a => `
            <button type="button" onclick="switchTab('program')" class="w-full text-left flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-emerald-400">
                <span class="w-11 shrink-0 text-center text-emerald-800"><b class="block text-lg leading-none">${new Date(a.tanggal + 'T00:00:00').getDate()}</b><span class="text-[10px] uppercase">${new Date(a.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short' })}</span></span>
                <span class="min-w-0">
                    <span class="block font-semibold text-slate-800 break-words">${escapeHtml(a.judul)}</span>
                    <span class="block text-xs text-slate-500">${escapeHtml(a.waktu || 'Waktu menyusul')} • ${escapeHtml(a.lokasi)}</span>
                </span>
            </button>`).join('') : `<p class="text-sm text-slate-400">${tanggalDipilih ? 'Tidak ada agenda di tanggal ini.' : 'Belum ada agenda bulan ini.'}</p>`);
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
    dataAgenda = data;
    renderKalender();
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
    loadAnggota();
    loadPerangkat();
    loadKarya();
    renderSholat();
    setInterval(renderSholat, 30000);
    renderKalender();
    loadAgenda();
    loadInformasi();
    loadDokumentasi();
};
