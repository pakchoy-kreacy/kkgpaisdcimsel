const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function urlPublik(bucket, path) {
    return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function tgl(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------- Navigasi: menu kartu, satu bagian per fitur ----------

const JUDUL = {
    dokumentasi: 'Galeri', informasi: 'Informasi', agenda: 'Agenda', presensi: 'Rekap Presensi',
    perangkat: 'Perangkat Ajar', karya: 'Karya Inovasi', pengurus: 'Pengurus', anggota: 'Anggota', aspirasi: 'Masukan',
    pengaturan: 'Pengaturan', akun: 'Akun'
};
let panelAktif = null;
let sudahLogin = false;

function tampil(nama) {
    panelAktif = nama;
    $('admin-menu').classList.toggle('hidden', !sudahLogin || nama !== null);
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('hidden', !sudahLogin || p.id !== 'tab-' + nama));
    $('judul-halaman').innerText = nama ? JUDUL[nama] : 'Admin KKG PAI SD';
    window.scrollTo(0, 0);
    if (nama && daftarMuat[nama]) daftarMuat[nama]();
}

function showApp(login) {
    sudahLogin = login;
    $('sec-login').classList.toggle('hidden', login);
    $('btn-logout').classList.toggle('hidden', !login);
    tampil(null);
}

$('btn-back').addEventListener('click', () => {
    if (sudahLogin && panelAktif) tampil(null);
    else location.href = 'index.html';
});
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => tampil(b.dataset.open)));

// ---------- Pembantu: formulir, unggah, daftar, CSV ----------

// Jalankan aksi simpan; hasil tampil di tombol (selalu terlihat) dan pesan kesalahan di bawahnya
async function kirim(form, aksi) {
    const btn = form.querySelector('[type="submit"]');
    const status = form.querySelector('[id$="-status"]');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerText = 'Menyimpan...';
    status.classList.add('hidden');
    try {
        await aksi();
        form.reset();
        btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i>Tersimpan';
        setTimeout(() => { btn.innerHTML = label; }, 2000);
    } catch (err) {
        console.error(err);
        btn.innerHTML = label;
        status.className = 'text-sm text-center text-red-600';
        status.innerText = err.message;
        status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
        btn.disabled = false;
    }
}

async function cek(promise, pesan) {
    const { error, data } = await promise;
    if (error) {
        console.error(error);
        throw new Error(pesan + ' ' + error.message);
    }
    return data;
}

async function unggah(bucket, file, awalan, maksMB, tipeGambar) {
    if (file.size > maksMB * 1024 * 1024) throw new Error(`Berkas maksimal ${maksMB} MB.`);
    if (tipeGambar && !['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Foto harus JPG atau PNG.');
    const path = `${awalan}${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await cek(db.storage.from(bucket).upload(path, file, { contentType: file.type }), 'Gagal mengunggah berkas.');
    return path;
}

async function hapusBerkas(bucket, path) {
    if (path) await db.storage.from(bucket).remove([path]);
}

const daftarMuat = {};

// Daftar dengan tombol aksi; klik tombol berlabel data-act dijalankan dengan baris datanya
function buatDaftar(ulId, { muat, baris, kosong, aksi, setelahMuat }) {
    const ul = $(ulId);
    let rows = new Map();

    async function segarkan() {
        let data;
        try {
            data = await muat();
        } catch (err) {
            console.error(err);
            ul.innerHTML = '<li class="py-3 text-red-600">Gagal memuat data.</li>';
            return;
        }
        rows = new Map(data.map(r => [String(r.id), r]));
        ul.innerHTML = data.length ? data.map(r => `<li class="py-3" data-row="${r.id}">${baris(r)}</li>`).join('') : `<li class="py-3 text-slate-400">${kosong}</li>`;
        if (setelahMuat) setelahMuat(data);
    }

    ul.addEventListener('click', async e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const row = rows.get(btn.closest('[data-row]').dataset.row);
        btn.disabled = true;
        try {
            if (await aksi[btn.dataset.act](row) !== false) await segarkan();
        } catch (err) {
            console.error(err);
            alert('Gagal: ' + err.message);
        } finally {
            btn.disabled = false;
        }
    });

    return segarkan;
}

const tombolHapus = '<button data-act="hapus" class="h-11 px-3 rounded-lg text-red-600 border border-red-200 text-xs font-semibold shrink-0">Hapus</button>';

function unduhCsv(namaBerkas, baris) {
    // Awalan apostrof mencegah rumus Excel dari isian orang lain (=, +, -, @)
    const aman = v => String(v ?? '').replace(/^([=+\-@\t\r])/, "'$1").replace(/"/g, '""');
    const csv = '﻿' + baris.map(r => r.map(v => `"${aman(v)}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = namaBerkas;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ---------- Galeri ----------

const muatDokumentasi = buatDaftar('list-dokumentasi', {
    muat: async () => cek(db.from('dokumentasi').select('*').order('tanggal', { ascending: false }), 'Gagal memuat.'),
    kosong: 'Belum ada foto.',
    baris: r => `
        <div class="flex items-center gap-3">
            <img src="${esc(r.foto_url || urlPublik('dokumentasi', r.foto_path))}" alt="" class="w-12 h-12 rounded-lg object-cover shrink-0">
            <div class="min-w-0 flex-1">
                <div class="font-semibold break-words">${esc(r.judul)}</div>
                <div class="text-xs text-slate-500">${esc(r.kategori)} • ${tgl(r.tanggal)} • ${esc(r.lokasi)}</div>
            </div>${tombolHapus}
        </div>`,
    aksi: {
        hapus: async r => {
            if (!confirm(`Hapus foto "${r.judul}"?`)) return false;
            await hapusBerkas('dokumentasi', r.foto_path);
            await cek(db.from('dokumentasi').delete().eq('id', r.id), 'Gagal menghapus.');
        }
    }
});
daftarMuat.dokumentasi = muatDokumentasi;

$('form-dokumentasi').addEventListener('submit', e => {
    e.preventDefault();
    kirim(e.target, async () => {
        const path = await unggah('dokumentasi', $('dok-foto').files[0], '', 3, true);
        try {
            await cek(db.from('dokumentasi').insert({
                judul: $('dok-judul').value, kategori: $('dok-kategori').value, tanggal: $('dok-tanggal').value,
                lokasi: $('dok-lokasi').value, deskripsi: $('dok-deskripsi').value, foto_path: path
            }), 'Gagal menyimpan data.');
        } catch (err) {
            await hapusBerkas('dokumentasi', path); // jangan tinggalkan foto tanpa data
            throw err;
        }
        muatDokumentasi();
    });
});

// ---------- Informasi ----------

const muatInformasi = buatDaftar('list-informasi', {
    muat: async () => cek(db.from('informasi').select('*').order('tanggal', { ascending: false }).order('id', { ascending: false }), 'Gagal memuat.'),
    kosong: 'Belum ada informasi.',
    baris: r => `
        <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
                <div class="font-semibold break-words">${esc(r.judul)}</div>
                <div class="text-xs text-slate-500">${tgl(r.tanggal)}</div>
            </div>${tombolHapus}
        </div>`,
    aksi: {
        hapus: async r => {
            if (!confirm(`Hapus informasi "${r.judul}"?`)) return false;
            await cek(db.from('informasi').delete().eq('id', r.id), 'Gagal menghapus.');
        }
    }
});
daftarMuat.informasi = muatInformasi;

$('form-informasi').addEventListener('submit', e => {
    e.preventDefault();
    kirim(e.target, async () => {
        await cek(db.from('informasi').insert({ judul: $('inf-judul').value, tanggal: $('inf-tanggal').value, isi: $('inf-isi').value }), 'Gagal menyimpan.');
        muatInformasi();
    });
});

// ---------- Agenda ----------

const muatAgenda = buatDaftar('list-agenda', {
    muat: async () => cek(db.from('agenda').select('*').order('tanggal', { ascending: false }), 'Gagal memuat.'),
    kosong: 'Belum ada agenda.',
    baris: r => `
        <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
                <div class="font-semibold break-words">${esc(r.judul)}</div>
                <div class="text-xs text-slate-500">${esc(r.kategori)} • ${tgl(r.tanggal)} • ${esc(r.lokasi)}</div>
                ${r.presensi_buka ? '<span class="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">Presensi dibuka</span>' : ''}
            </div>
            <div class="flex flex-col gap-2 shrink-0">
                <button data-act="presensi" class="h-11 px-3 rounded-lg ${r.presensi_buka ? 'bg-amber-500 text-slate-900' : 'bg-emerald-600 text-white'} text-xs font-bold">${r.presensi_buka ? 'Tutup presensi' : 'Buka presensi'}</button>
                ${tombolHapus}
            </div>
        </div>`,
    aksi: {
        presensi: async r => cek(db.from('agenda').update({ presensi_buka: !r.presensi_buka }).eq('id', r.id), 'Gagal mengubah presensi.'),
        hapus: async r => {
            if (!confirm(`Hapus agenda "${r.judul}"? Data presensinya ikut terhapus.`)) return false;
            await cek(db.from('agenda').delete().eq('id', r.id), 'Gagal menghapus.');
        }
    }
});
daftarMuat.agenda = muatAgenda;

$('form-agenda').addEventListener('submit', e => {
    e.preventDefault();
    kirim(e.target, async () => {
        await cek(db.from('agenda').insert({
            judul: $('ag-judul').value, kategori: $('ag-kategori').value, tanggal: $('ag-tanggal').value,
            waktu: $('ag-waktu').value, lokasi: $('ag-lokasi').value, deskripsi: $('ag-deskripsi').value,
            presensi_buka: $('ag-buka').checked
        }), 'Gagal menyimpan.');
        muatAgenda();
    });
});

// ---------- Rekap presensi ----------

let agendaPresensi = [];
let barisPresensi = [];

const muatPresensi = buatDaftar('list-presensi', {
    muat: async () => {
        const id = $('pres-pilih').value;
        if (!id) return [];
        return cek(db.from('presensi').select('*').eq('agenda_id', id).order('created_at'), 'Gagal memuat.');
    },
    kosong: 'Belum ada yang hadir.',
    baris: r => `
        <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
                <div class="font-semibold break-words">${esc(r.nama)}</div>
                <div class="text-xs text-slate-500">${esc(r.sekolah)} • ${esc(r.gugus)} • ${new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>${tombolHapus}
        </div>`,
    aksi: {
        hapus: async r => {
            if (!confirm(`Hapus presensi "${r.nama}"?`)) return false;
            await cek(db.from('presensi').delete().eq('id', r.id), 'Gagal menghapus.');
        }
    },
    setelahMuat: data => {
        barisPresensi = data;
        $('pres-total').innerText = `${data.length} hadir`;
    }
});

daftarMuat.presensi = async () => {
    agendaPresensi = await cek(db.from('agenda').select('id, judul, tanggal').order('tanggal', { ascending: false }), 'Gagal memuat agenda.');
    $('pres-pilih').innerHTML = agendaPresensi.length
        ? agendaPresensi.map(a => `<option value="${a.id}">${esc(a.judul)} (${tgl(a.tanggal)})</option>`).join('')
        : '<option value="">Belum ada agenda</option>';
    muatPresensi();
};
$('pres-pilih').addEventListener('change', () => muatPresensi());

$('btn-csv-presensi').addEventListener('click', () => {
    const agenda = agendaPresensi.find(a => String(a.id) === $('pres-pilih').value);
    if (!agenda || barisPresensi.length === 0) return alert('Belum ada data presensi untuk diunduh.');
    unduhCsv(`presensi-${agenda.tanggal}.csv`, [
        ['No', 'Nama', 'Sekolah', 'Gugus', 'Waktu'],
        ...barisPresensi.map((r, i) => [i + 1, r.nama, r.sekolah, r.gugus, new Date(r.created_at).toLocaleString('id-ID')])
    ]);
});

// ---------- Perangkat ajar ----------

const muatPerangkat = buatDaftar('list-perangkat', {
    muat: async () => cek(db.from('perangkat_ajar').select('*').order('created_at', { ascending: false }), 'Gagal memuat.'),
    kosong: 'Belum ada perangkat ajar.',
    baris: r => `
        <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
                <div class="font-semibold break-words">${esc(r.judul)}</div>
                <div class="text-xs text-slate-500">${esc(r.jenis)} • Kelas ${esc(r.kelas)} • ${r.url ? 'Tautan' : 'Berkas'}</div>
            </div>${tombolHapus}
        </div>`,
    aksi: {
        hapus: async r => {
            if (!confirm(`Hapus "${r.judul}"?`)) return false;
            await hapusBerkas('perangkat-ajar', r.file_path);
            await cek(db.from('perangkat_ajar').delete().eq('id', r.id), 'Gagal menghapus.');
        }
    }
});
daftarMuat.perangkat = async () => {
    const { data } = await db.from('pengaturan').select('daftar_jenis_perangkat').eq('id', 1).single();
    if (data) $('pa-jenis').innerHTML = data.daftar_jenis_perangkat.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    muatPerangkat();
};

$('form-perangkat').addEventListener('submit', e => {
    e.preventDefault();
    kirim(e.target, async () => {
        const url = $('pa-url').value.trim();
        const file = $('pa-file').files[0];
        if (!url && !file) throw new Error('Isi tautan atau pilih berkas.');
        const path = file ? await unggah('perangkat-ajar', file, '', 10, false) : null;
        try {
            await cek(db.from('perangkat_ajar').insert({
                judul: $('pa-judul').value, jenis: $('pa-jenis').value, kelas: $('pa-kelas').value,
                deskripsi: $('pa-deskripsi').value || null, url: url || null, file_path: path
            }), 'Gagal menyimpan.');
        } catch (err) {
            await hapusBerkas('perangkat-ajar', path);
            throw err;
        }
        muatPerangkat();
    });
});

// ---------- Karya inovasi digital ----------

daftarMuat.karya = buatDaftar('list-karya', {
    // kiriman guru yang menunggu persetujuan tampil paling atas
    muat: async () => (await cek(db.from('karya').select('*').order('created_at', { ascending: false }), 'Gagal memuat.'))
        .sort((a, b) => a.disetujui - b.disetujui),
    kosong: 'Belum ada karya.',
    baris: r => `
        <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
                <div class="font-semibold break-words">${esc(r.judul)}
                    ${r.disetujui ? '' : '<span class="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">Menunggu</span>'}
                </div>
                <div class="text-xs text-slate-500">${esc(r.nama_guru)} • ${esc(r.sekolah)} • ${esc(r.jenis)}</div>
                <a href="${esc(r.url)}" target="_blank" rel="noopener" class="inline-flex items-center h-9 text-xs text-emerald-700 underline break-all">Periksa tautan</a>
                ${r.deskripsi ? `<p class="text-xs text-slate-600 break-words">${esc(r.deskripsi)}</p>` : ''}
            </div>
            <div class="flex flex-col gap-2 shrink-0">
                ${r.disetujui ? '' : '<button data-act="setujui" class="h-11 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold">Setujui</button>'}
                ${tombolHapus}
            </div>
        </div>`,
    aksi: {
        setujui: async r => cek(db.from('karya').update({ disetujui: true }).eq('id', r.id), 'Gagal menyetujui.'),
        hapus: async r => {
            if (!confirm(`Hapus karya "${r.judul}"?`)) return false;
            await hapusBerkas('dokumentasi', r.sampul_path);
            await cek(db.from('karya').delete().eq('id', r.id), 'Gagal menghapus.');
        }
    },
    setelahMuat: data => {
        const menunggu = data.filter(r => !r.disetujui).length;
        $('karya-total').innerText = data.length ? `(${data.length}${menunggu ? `, ${menunggu} menunggu` : ''})` : '';
    }
});

$('form-karya').addEventListener('submit', e => {
    e.preventDefault();
    kirim(e.target, async () => {
        const file = $('kr-sampul').files[0];
        const path = file ? await unggah('dokumentasi', file, 'karya/', 3, true) : null;
        try {
            await cek(db.from('karya').insert({
                judul: $('kr-judul').value.trim(), nama_guru: $('kr-nama').value.trim(), sekolah: $('kr-sekolah').value.trim(),
                jenis: $('kr-jenis').value, url: $('kr-url').value.trim(), deskripsi: $('kr-deskripsi').value.trim() || null,
                sampul_path: path, disetujui: true
            }), 'Gagal menyimpan.');
        } catch (err) {
            await hapusBerkas('dokumentasi', path);
            throw err;
        }
        daftarMuat.karya();
    });
});

// ---------- Pengurus ----------

const muatPengurus = buatDaftar('list-pengurus', {
    muat: async () => cek(db.from('pengurus').select('*').order('urutan').order('id'), 'Gagal memuat.'),
    kosong: 'Belum ada pengurus.',
    baris: r => `
        <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
                <div class="font-semibold break-words">${esc(r.nama)}</div>
                <div class="text-xs text-slate-500">${esc(r.jabatan)} • urutan ${r.urutan}</div>
            </div>${tombolHapus}
        </div>`,
    aksi: {
        hapus: async r => {
            if (!confirm(`Hapus pengurus "${r.nama}"?`)) return false;
            await hapusBerkas('dokumentasi', r.foto_path);
            await cek(db.from('pengurus').delete().eq('id', r.id), 'Gagal menghapus.');
        }
    }
});
daftarMuat.pengurus = muatPengurus;

$('form-pengurus').addEventListener('submit', e => {
    e.preventDefault();
    kirim(e.target, async () => {
        const file = $('pg-foto').files[0];
        const path = file ? await unggah('dokumentasi', file, 'pengurus/', 3, true) : null;
        try {
            await cek(db.from('pengurus').insert({
                nama: $('pg-nama').value, jabatan: $('pg-jabatan').value,
                urutan: Number($('pg-urutan').value) || 100, foto_path: path
            }), 'Gagal menyimpan.');
        } catch (err) {
            await hapusBerkas('dokumentasi', path);
            throw err;
        }
        $('pg-urutan').value = 10;
        muatPengurus();
    });
});

// ---------- Anggota ----------

let dataAnggota = [];

const muatAnggota = buatDaftar('list-anggota', {
    // yang menunggu persetujuan tampil paling atas
    muat: async () => (await cek(db.from('anggota').select('*').order('created_at', { ascending: false }), 'Gagal memuat.'))
        .sort((a, b) => a.disetujui - b.disetujui),
    kosong: 'Belum ada anggota.',
    baris: r => `
        <div class="flex items-center gap-3">
            <img src="${esc(fotoAnggota(r))}" alt="" class="w-12 h-12 rounded-full object-cover bg-slate-100 shrink-0">
            <div class="min-w-0 flex-1">
                <div class="font-semibold break-words">${esc(r.nama)}
                    ${r.disetujui ? '' : '<span class="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">Menunggu</span>'}
                </div>
                <div class="text-xs text-slate-500">${esc(r.sekolah)} • ${esc(r.kelurahan)} • ${esc(r.gugus)} • ${esc(r.status)}</div>
                <button data-act="sertifikasi" class="mt-1 h-9 px-3 rounded-lg text-xs font-semibold ${r.sertifikasi === 'Sudah' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">Sertifikasi: ${esc(r.sertifikasi)} (ubah)</button>
            </div>
            <div class="flex flex-col gap-2 shrink-0">
                ${r.disetujui ? '' : '<button data-act="setujui" class="h-11 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold">Setujui</button>'}
                <button data-act="edit" class="h-11 px-3 rounded-lg border border-emerald-600 text-emerald-700 text-xs font-bold">Edit</button>
                ${tombolHapus}
            </div>
        </div>`,
    aksi: {
        edit: async r => { bukaEditAnggota(r); return false; },
        setujui: async r => cek(db.from('anggota').update({ disetujui: true }).eq('id', r.id), 'Gagal menyetujui.'),
        sertifikasi: async r => cek(db.from('anggota').update({ sertifikasi: r.sertifikasi === 'Sudah' ? 'Belum' : 'Sudah' }).eq('id', r.id), 'Gagal mengubah.'),
        hapus: async r => {
            if (!confirm(`Hapus data anggota "${r.nama}"?`)) return false;
            await cek(db.from('anggota').delete().eq('id', r.id), 'Gagal menghapus.');
            await hapusBerkas('foto-anggota', r.foto_path);
        }
    },
    setelahMuat: data => {
        dataAnggota = data;
        const menunggu = data.filter(r => !r.disetujui).length;
        $('anggota-total').innerText = `(${data.length}${menunggu ? `, ${menunggu} menunggu` : ''})`;
    }
});
daftarMuat.anggota = async () => {
    $('form-edit-anggota').classList.add('hidden');
    const { data } = await db.from('pengaturan').select('daftar_kelurahan, daftar_gugus').eq('id', 1).single();
    if (data) {
        daftarPilihan.kelurahan = data.daftar_kelurahan;
        daftarPilihan.gugus = data.daftar_gugus;
    }
    muatAnggota();
};

// ---------- Edit anggota ----------

const daftarPilihan = { kelurahan: [], gugus: [] };
let anggotaDiedit = null;

function fotoAnggota(r) {
    if (r.foto_path) return urlPublik('foto-anggota', r.foto_path);
    const inisial = r.nama.trim().split(/\s+/).slice(0, 2).map(k => k[0]).join('').toUpperCase();
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="%23d1fae5"/><text x="24" y="30" font-family="sans-serif" font-size="17" font-weight="700" fill="%23065f46" text-anchor="middle">${encodeURIComponent(inisial)}</text></svg>`;
}

// Isi pilihan; nilai lama yang sudah tidak ada di daftar tetap dipertahankan
function isiPilihan(select, daftar, nilai) {
    const semua = daftar.includes(nilai) ? daftar : [nilai, ...daftar];
    select.innerHTML = semua.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    select.value = nilai;
}

function bukaEditAnggota(r) {
    anggotaDiedit = r;
    $('ed-nama').value = r.nama;
    $('ed-nip').value = r.nip === '-' ? '' : r.nip;
    $('ed-sekolah').value = r.sekolah;
    isiPilihan($('ed-kelurahan'), daftarPilihan.kelurahan, r.kelurahan);
    isiPilihan($('ed-gugus'), daftarPilihan.gugus, r.gugus);
    $('ed-status').value = r.status;
    $('ed-sertifikasi').value = r.sertifikasi;
    $('ed-foto').value = '';
    $('ed-foto-hapus').checked = false;
    $('ed-foto-hapus').closest('label').classList.toggle('hidden', !r.foto_path);
    $('ed-foto-preview').src = fotoAnggota(r);
    $('form-edit-anggota-status').classList.add('hidden');
    $('form-edit-anggota').classList.remove('hidden');
    $('form-edit-anggota').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('btn-batal-edit').addEventListener('click', () => $('form-edit-anggota').classList.add('hidden'));

$('ed-foto').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
        $('ed-foto-preview').src = URL.createObjectURL(file);
        $('ed-foto-hapus').checked = false;
    }
});

$('form-edit-anggota').addEventListener('submit', e => {
    e.preventDefault();
    const r = anggotaDiedit;
    kirim(e.target, async () => {
        const file = $('ed-foto').files[0];
        let foto_path = $('ed-foto-hapus').checked ? null : r.foto_path;
        if (file) {
            const foto = await kecilkanFoto(file);
            foto_path = namaFotoAcak('admin');
            await cek(db.storage.from('foto-anggota').upload(foto_path, foto, { contentType: 'image/jpeg' }), 'Gagal mengunggah foto.');
        }
        try {
            await cek(db.from('anggota').update({
                nama: $('ed-nama').value, nip: $('ed-nip').value.trim() || '-', sekolah: $('ed-sekolah').value,
                kelurahan: $('ed-kelurahan').value, gugus: $('ed-gugus').value,
                status: $('ed-status').value, sertifikasi: $('ed-sertifikasi').value, foto_path
            }).eq('id', r.id), 'Gagal menyimpan.');
        } catch (err) {
            if (file) await hapusBerkas('foto-anggota', foto_path);
            throw err;
        }
        if (r.foto_path && r.foto_path !== foto_path) await hapusBerkas('foto-anggota', r.foto_path);
        $('form-edit-anggota').classList.add('hidden');
        muatAnggota();
    });
});

$('btn-csv-anggota').addEventListener('click', () => {
    if (dataAnggota.length === 0) return alert('Belum ada data anggota.');
    unduhCsv('anggota-kkg-pai-sd.csv', [
        ['No', 'Nama', 'NIP/NUPTK', 'Sekolah', 'Kelurahan', 'Gugus', 'Status', 'Sertifikasi', 'Disetujui'],
        ...dataAnggota.map((r, i) => [i + 1, r.nama, r.nip, r.sekolah, r.kelurahan, r.gugus, r.status, r.sertifikasi, r.disetujui ? 'Ya' : 'Belum'])
    ]);
});

// ---------- Masukan ----------

daftarMuat.aspirasi = buatDaftar('list-aspirasi', {
    muat: async () => cek(db.from('aspirasi').select('*').order('created_at', { ascending: false }), 'Gagal memuat.'),
    kosong: 'Belum ada masukan.',
    baris: r => `
        <div class="space-y-1">
            <div class="flex items-start justify-between gap-3">
                <div class="font-semibold break-words">${esc(r.nama)} <span class="font-normal text-slate-500">• ${esc(r.sekolah)}</span></div>${tombolHapus}
            </div>
            <div class="text-xs text-emerald-700">${esc(r.kategori)} • ${new Date(r.created_at).toLocaleString('id-ID')}</div>
            <p class="text-slate-700 whitespace-pre-line break-words">${esc(r.pesan)}</p>
        </div>`,
    aksi: {
        hapus: async r => {
            if (!confirm('Hapus masukan ini?')) return false;
            await cek(db.from('aspirasi').delete().eq('id', r.id), 'Gagal menghapus.');
        }
    }
});

// ---------- Pengaturan ----------

const KOLOM_TEKS = ['profil', 'alamat', 'email', 'telepon', 'facebook', 'youtube', 'instagram'];
const KOLOM_DAFTAR = ['daftar_gugus', 'daftar_kelurahan', 'daftar_jenis_perangkat'];

daftarMuat.pengaturan = async () => {
    const { data, error } = await db.from('pengaturan').select('*').eq('id', 1).single();
    if (error) return console.error(error);
    KOLOM_TEKS.forEach(k => { $('set-' + k).value = data[k]; });
    KOLOM_DAFTAR.forEach(k => { $('set-' + k).value = data[k].join('\n'); });
    logoSekarang = data.logo_path;
    $('logo-preview').src = data.logo_path ? urlPublik('dokumentasi', data.logo_path) : DEFAULT_LOGO;
};

// Logo: diunggah langsung, terpisah dari tombol Simpan Pengaturan
let logoSekarang = null;

// Hapus semua berkas di folder logo/ selain logo yang sedang dipakai
async function bersihkanLogoLama(pathDipakai) {
    const { data, error } = await db.storage.from('dokumentasi').list('logo', { limit: 1000 });
    if (error) return console.error(error);
    const lama = data.map(f => 'logo/' + f.name).filter(p => p !== pathDipakai);
    for (let i = 0; i < lama.length; i += 100) {
        await db.storage.from('dokumentasi').remove(lama.slice(i, i + 100));
    }
}

async function gantiLogo(btn, pathBaru) {
    const status = $('logo-status');
    btn.disabled = true;
    status.className = 'text-sm text-center text-slate-600';
    status.innerText = 'Menyimpan...';
    try {
        await cek(db.from('pengaturan').update({ logo_path: pathBaru }).eq('id', 1), 'Gagal menyimpan logo.');
        await bersihkanLogoLama(pathBaru);
        logoSekarang = pathBaru;
        $('logo-preview').src = pathBaru ? urlPublik('dokumentasi', pathBaru) : DEFAULT_LOGO;
        $('logo-file').value = '';
        status.innerText = 'Logo tersimpan. Muat ulang portal untuk melihatnya.';
    } catch (err) {
        await hapusBerkas('dokumentasi', pathBaru);
        status.className = 'text-sm text-center text-red-600';
        status.innerText = err.message;
    } finally {
        btn.disabled = false;
    }
}

$('btn-logo-simpan').addEventListener('click', async e => {
    const btn = e.currentTarget; // simpan sebelum await; setelahnya currentTarget bernilai null
    const file = $('logo-file').files[0];
    if (!file) {
        $('logo-status').className = 'text-sm text-center text-red-600';
        $('logo-status').innerText = 'Pilih berkas logo dulu.';
        return;
    }
    let path;
    try {
        path = await unggah('dokumentasi', file, 'logo/', 2, true);
    } catch (err) {
        $('logo-status').className = 'text-sm text-center text-red-600';
        $('logo-status').innerText = err.message;
        return;
    }
    gantiLogo(btn, path);
});

$('btn-logo-reset').addEventListener('click', e => {
    if (!logoSekarang) return;
    if (confirm('Kembalikan ke logo bawaan?')) gantiLogo(e.currentTarget, null);
});

$('form-pengaturan').addEventListener('submit', e => {
    e.preventDefault();
    kirim(e.target, async () => {
        const row = { updated_at: new Date().toISOString() };
        KOLOM_TEKS.forEach(k => { row[k] = $('set-' + k).value.trim(); });
        KOLOM_DAFTAR.forEach(k => {
            row[k] = [...new Set($('set-' + k).value.split('\n').map(v => v.trim()).filter(Boolean))];
        });
        await cek(db.from('pengaturan').update(row).eq('id', 1), 'Gagal menyimpan.');
        daftarMuat.pengaturan(); // form.reset() mengosongkan isian; isi ulang dari database
    });
});

// ---------- Akun, login, lupa kata sandi ----------

daftarMuat.akun = async () => {
    const { data } = await db.auth.getUser();
    $('akun-email').innerText = data.user ? `Masuk sebagai ${data.user.email}` : '';
    $('pw-username').value = data.user ? data.user.email : '';
};

$('form-password').addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('pw-status');
    status.classList.remove('hidden');
    if ($('pw-baru').value !== $('pw-ulang').value) {
        status.innerText = 'Kata sandi tidak sama.';
        return;
    }
    const { error } = await db.auth.updateUser({ password: $('pw-baru').value });
    if (error) {
        console.error(error);
        status.innerText = 'Gagal mengubah kata sandi: ' + error.message;
        return;
    }
    status.innerText = 'Kata sandi berhasil diubah.';
    $('form-password').reset();
});

$('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await db.auth.signInWithPassword({
        email: $('login-email').value.trim(),
        password: $('login-password').value
    });
    if (error) {
        $('login-error').innerText = 'Email atau kata sandi salah.';
        $('login-error').classList.remove('hidden');
        return;
    }
    showApp(true);
});

$('btn-lupa').addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const status = $('lupa-status');
    status.classList.remove('hidden');
    if (!email) {
        status.innerText = 'Isi email pengurus dulu di kolom di atas.';
        return;
    }
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) {
        console.error(error);
        status.innerText = 'Gagal mengirim email: ' + error.message;
        return;
    }
    status.innerText = 'Jika email terdaftar, tautan reset kata sandi sudah dikirim. Cek kotak masuk atau spam.';
});

db.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') {
        showApp(true);
        tampil('akun');
        $('pw-status').classList.remove('hidden');
        $('pw-status').innerText = 'Silakan isi kata sandi baru.';
    }
});

$('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    location.reload();
});

async function init() {
    if (location.hash.includes('type=recovery')) return; // ditangani oleh PASSWORD_RECOVERY
    const { data } = await db.auth.getSession();
    showApp(!!data.session);
}

init();
