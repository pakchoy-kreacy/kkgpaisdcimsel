const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dataAnggota = [];

// Logo SVG (fallback inline)
function setupLogo() {
    const logoSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><circle cx="150" cy="150" r="146" fill="%23047857" stroke="%23000" stroke-width="5"/><circle cx="150" cy="150" r="122" fill="%2310b981" stroke="%23064e3b" stroke-width="4"/><g fill="none" stroke="%23f59e0b" stroke-width="8" stroke-linecap="round"><path d="M 120 180 L 120 130 L 150 100 L 180 130 L 180 180"/><path d="M 135 180 L 135 140 L 150 120 L 165 140 L 165 180"/></g><path d="M 150 82 A 5 5 0 0 1 150 92 A 6 6 0 1 0 150 80 Z" fill="%23ecfdf5"/><g fill="%23a7f3d0"><circle cx="150" cy="74" r="3"/><circle cx="132" cy="78" r="3"/><circle cx="168" cy="78" r="3"/><circle cx="116" cy="88" r="3"/><circle cx="184" cy="88" r="3"/><circle cx="104" cy="104" r="3"/><circle cx="196" cy="104" r="3"/><circle cx="98" cy="124" r="3"/><circle cx="202" cy="124" r="3"/></g><path id="arc-top" d="M 35 150 A 115 115 0 1 1 265 150" fill="none"/><path id="arc-bottom" d="M 265 150 A 115 115 0 0 1 35 150" fill="none"/><text fill="white" font-family="sans-serif" font-weight="900" font-size="14.5" letter-spacing="1"><textPath href="%23arc-top" startOffset="50%" text-anchor="middle">★ KELOMPOK KERJA GURU ★</textPath></text><text fill="white" font-family="sans-serif" font-weight="bold" font-size="16" x="150" y="52" text-anchor="middle">KKG PAI SD</text><text fill="white" font-family="sans-serif" font-weight="bold" font-size="11.5" x="150" y="215" text-anchor="middle">KECAMATAN CIMAHI SELATAN</text><text fill="white" font-family="sans-serif" font-weight="900" font-size="12" letter-spacing="0.5"><textPath href="%23arc-bottom" startOffset="50%" text-anchor="middle">PENDIDIKAN AGAMA ISLAM SEKOLAH DASAR</textPath></text></svg>`;
    document.getElementById('kkg-logo').src = logoSvg;
    document.getElementById('footer-logo').src = logoSvg;
}

// Tab switching
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toast
function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3500);
}

// Statistik dihitung dari data anggota
function updateStats() {
    const gugus = new Set(dataAnggota.map(i => i.gugus));
    const kelurahan = new Set(dataAnggota.map(i => i.kelurahan));
    document.getElementById('stat-total-guru').innerText = dataAnggota.length;
    document.getElementById('stat-total-gugus').innerText = gugus.size;
    document.getElementById('stat-total-kelurahan').innerText = kelurahan.size;
}

// Data anggota
async function loadAnggota() {
    const { data, error } = await db.from('anggota').select('*').eq('disetujui', true).order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        showToast('Gagal memuat data anggota.');
        return;
    }
    dataAnggota = data;
    updateStats();
    filterAnggota();
}

function renderAnggota(items) {
    const tbody = document.getElementById('table-body-anggota');
    const mobile = document.getElementById('list-anggota-mobile');
    tbody.innerHTML = '';
    mobile.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">Data anggota tidak ditemukan.</td></tr>`;
        mobile.innerHTML = `<p class="bg-white rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-400">Data anggota tidak ditemukan.</p>`;
        return;
    }

    items.forEach((item, index) => {
        let badgeColor = 'bg-slate-100 text-slate-800';
        if (item.status === 'PNS') badgeColor = 'bg-emerald-100 text-emerald-800';
        else if (item.status === 'PPPK') badgeColor = 'bg-blue-100 text-blue-800';
        else if (item.status.includes('Non ASN')) badgeColor = 'bg-purple-100 text-purple-800';
        else if (item.status === 'GTT' || item.status === 'GTY') badgeColor = 'bg-amber-100 text-amber-800';

        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 hover:bg-slate-50 transition';
        tr.innerHTML = `
            <td class="p-4 font-medium">${index + 1}</td>
            <td class="p-4">
                <div class="font-bold text-slate-800">${escapeHtml(item.nama)}</div>
                <div class="text-xs text-slate-400">NIP/NUPTK: ${escapeHtml(item.nip)}</div>
            </td>
            <td class="p-4 font-medium text-slate-700">${escapeHtml(item.sekolah)}</td>
            <td class="p-4">${escapeHtml(item.kelurahan)}</td>
            <td class="p-4"><span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">${escapeHtml(item.gugus)}</span></td>
            <td class="p-4"><span class="px-2.5 py-1 ${badgeColor} rounded-full text-xs font-bold">${escapeHtml(item.status)}</span></td>
        `;
        tbody.appendChild(tr);

        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-4';
        card.innerHTML = `
            <div class="flex justify-between items-start gap-3">
                <div class="min-w-0">
                    <div class="font-bold text-slate-800 break-words">${escapeHtml(item.nama)}</div>
                    <div class="text-xs text-slate-400 break-all">NIP/NUPTK: ${escapeHtml(item.nip)}</div>
                </div>
                <span class="shrink-0 px-2.5 py-1 ${badgeColor} rounded-full text-xs font-bold">${escapeHtml(item.status)}</span>
            </div>
            <div class="mt-3 text-sm text-slate-700 font-medium">${escapeHtml(item.sekolah)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.kelurahan)} • ${escapeHtml(item.gugus)}</div>`;
        mobile.appendChild(card);
    });
}

function filterAnggota() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const kelurahan = document.getElementById('filter-kelurahan').value;
    const gugus = document.getElementById('filter-gugus').value;

    const filtered = dataAnggota.filter(item => {
        const matchSearch = item.nama.toLowerCase().includes(search) ||
                            item.sekolah.toLowerCase().includes(search) ||
                            item.nip.includes(search);
        const matchKelurahan = kelurahan === '' || item.kelurahan === kelurahan;
        const matchGugus = gugus === '' || item.gugus === gugus;
        return matchSearch && matchKelurahan && matchGugus;
    });

    renderAnggota(filtered);
}

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
        status: document.getElementById('add-status').value
    };

    const { error } = await db.from('anggota').insert(row);
    if (error) {
        console.error(error);
        showToast('Gagal menyimpan data anggota.');
        return;
    }
    closeModalTambahAnggota();
    document.getElementById('form-tambah-anggota').reset();
    showToast('Pendaftaran terkirim. Data tampil setelah disetujui pengurus.');
}

// Aspirasi
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
        showToast('Gagal mengirim aspirasi.');
        return;
    }
    form.reset();
    showToast('Aspirasi Anda berhasil dikirim. Terima kasih!');
}

// Galeri dokumentasi
async function loadDokumentasi() {
    const grid = document.getElementById('galeri-grid');
    const { data, error } = await db.from('dokumentasi').select('*').order('tanggal', { ascending: false });
    if (error) {
        console.error(error);
        grid.innerHTML = `<p class="col-span-3 text-center text-slate-400">Gagal memuat dokumentasi.</p>`;
        return;
    }
    if (data.length === 0) {
        grid.innerHTML = `<p class="col-span-3 text-center text-slate-400">Belum ada dokumentasi.</p>`;
        return;
    }

    grid.innerHTML = data.map(item => {
        const src = item.foto_url || db.storage.from(STORAGE_BUCKET).getPublicUrl(item.foto_path).data.publicUrl;
        const tanggal = new Date(item.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        return `
            <div class="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 hover:shadow-xl transition">
                <img src="${escapeHtml(src)}" alt="${escapeHtml(item.judul)}" class="w-full h-48 object-cover">
                <div class="p-5">
                    <span class="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md">${escapeHtml(item.kategori)}</span>
                    <h3 class="font-bold text-slate-800 mt-3 mb-2">${escapeHtml(item.judul)}</h3>
                    <p class="text-xs text-slate-500 mb-3"><i class="fa-regular fa-calendar mr-1"></i> ${tanggal} • ${escapeHtml(item.lokasi)}</p>
                    <p class="text-sm text-slate-600">${escapeHtml(item.deskripsi || '')}</p>
                </div>
            </div>`;
    }).join('');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('mobile-menu').classList.toggle('hidden');
});

window.onload = function() {
    setupLogo();
    loadAnggota();
    loadDokumentasi();
};
