const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showTab(name) {
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + name));
    document.querySelectorAll('.admin-tab').forEach(b => {
        if (b.dataset.tab === name) {
            b.setAttribute('aria-current', 'page');
            $('judul-halaman').innerText = b.innerText.trim();
        } else {
            b.removeAttribute('aria-current');
        }
    });
    window.scrollTo(0, 0);
    if (name === 'dokumentasi') loadDokumentasi();
    if (name === 'aspirasi') loadAspirasi();
    if (name === 'anggota') loadAnggota();
    if (name === 'akun') loadAkun();
    if (name === 'kontak') loadKontak();
}

// Kontak & sosmed
const KOLOM_KONTAK = ['alamat', 'email', 'telepon', 'facebook', 'youtube', 'instagram'];
const KOLOM_DAFTAR = ['daftar_gugus', 'daftar_kelurahan'];

async function loadKontak() {
    const { data, error } = await db.from('pengaturan').select('*').eq('id', 1).single();
    if (error) {
        console.error(error);
        return;
    }
    KOLOM_KONTAK.forEach(k => { $('set-' + k).value = data[k]; });
    KOLOM_DAFTAR.forEach(k => { $('set-' + k).value = data[k].join('\n'); });
}

$('form-kontak').addEventListener('submit', async e => {
    e.preventDefault();
    const row = { updated_at: new Date().toISOString() };
    KOLOM_KONTAK.forEach(k => { row[k] = $('set-' + k).value.trim(); });
    KOLOM_DAFTAR.forEach(k => {
        row[k] = [...new Set($('set-' + k).value.split('\n').map(v => v.trim()).filter(Boolean))];
    });

    // Hasil simpan ditampilkan di tombol, karena tombolnya selalu terlihat di layar
    const btn = e.submitter || $('form-kontak').querySelector('[type="submit"]');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerText = 'Menyimpan...';
    const { error } = await db.from('pengaturan').update(row).eq('id', 1);
    btn.disabled = false;

    const status = $('kontak-status');
    if (error) {
        console.error(error);
        btn.innerHTML = label;
        status.classList.remove('hidden');
        status.className = 'text-sm text-center text-red-600';
        status.innerText = 'Gagal menyimpan: ' + error.message;
        status.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    status.classList.add('hidden');
    btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i>Tersimpan';
    setTimeout(() => { btn.innerHTML = label; }, 2000);
});

// Akun
async function loadAkun() {
    const { data } = await db.auth.getUser();
    $('akun-email').innerText = data.user ? `Masuk sebagai ${data.user.email}` : '';
}

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

function showApp(loggedIn) {
    $('sec-login').classList.toggle('hidden', loggedIn);
    $('admin-tabs').classList.toggle('hidden', !loggedIn);
    // ruang untuk bar navigasi bawah di HP
    $('admin-main').classList.toggle('pb-28', loggedIn);
    $('admin-main').classList.toggle('md:pb-6', loggedIn);
    $('btn-logout').classList.toggle('hidden', !loggedIn);
    if (loggedIn) showTab('dokumentasi');
}

async function init() {
    if (location.hash.includes('type=recovery')) return; // ditangani oleh PASSWORD_RECOVERY
    const { data } = await db.auth.getSession();
    showApp(!!data.session);
}

document.querySelectorAll('.admin-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

$('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await db.auth.signInWithPassword({
        email: $('login-email').value,
        password: $('login-password').value
    });
    if (error) {
        $('login-error').innerText = 'Email atau kata sandi salah.';
        $('login-error').classList.remove('hidden');
        return;
    }
    showApp(true);
});

// Lupa kata sandi: kirim tautan reset ke email, lalu buka tab Akun saat kembali lewat tautan
$('btn-lupa').addEventListener('click', async () => {
    const email = $('login-email').value;
    const status = $('lupa-status');
    status.classList.remove('hidden');
    if (!email) {
        status.innerText = 'Isi email pengurus dulu di kolom di atas.';
        return;
    }
    const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
    });
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
        showTab('akun');
        $('pw-status').classList.remove('hidden');
        $('pw-status').innerText = 'Silakan isi kata sandi baru.';
    }
});

$('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    location.reload();
});

// Dokumentasi
$('form-upload').addEventListener('submit', async e => {
    e.preventDefault();
    const file = $('up-foto').files[0];
    const status = $('up-status');
    status.classList.remove('hidden');

    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 3 * 1024 * 1024) {
        status.innerText = 'Foto harus JPG/PNG, maksimal 3 MB.';
        return;
    }

    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    status.innerText = 'Mengunggah foto...';

    const { error: upErr } = await db.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type });
    if (upErr) {
        console.error(upErr);
        status.innerText = 'Gagal mengunggah foto.';
        return;
    }

    const { error } = await db.from('dokumentasi').insert({
        judul: $('up-judul').value,
        kategori: $('up-kategori').value,
        tanggal: $('up-tanggal').value,
        lokasi: $('up-lokasi').value,
        deskripsi: $('up-deskripsi').value,
        foto_path: path
    });
    if (error) {
        console.error(error);
        await db.storage.from(STORAGE_BUCKET).remove([path]);
        status.innerText = 'Gagal menyimpan data dokumentasi. Foto tidak disimpan.';
        return;
    }

    status.innerText = 'Dokumentasi berhasil disimpan.';
    $('form-upload').reset();
    loadDokumentasi();
});

async function loadDokumentasi() {
    const { data, error } = await db.from('dokumentasi').select('*').order('tanggal', { ascending: false });
    const list = $('list-dokumentasi');
    list.innerHTML = '';
    if (error) {
        list.innerHTML = '<li class="py-3 text-red-600">Gagal memuat daftar.</li>';
        return;
    }
    data.forEach(item => {
        const li = document.createElement('li');
        li.className = 'py-3 flex justify-between items-center gap-4';
        li.innerHTML = `
            <div>
                <div class="font-semibold">${escapeHtml(item.judul)}</div>
                <div class="text-xs text-slate-500">${escapeHtml(item.kategori)} • ${item.tanggal} • ${escapeHtml(item.lokasi)}</div>
            </div>
            <button class="text-red-600 hover:underline text-xs">Hapus</button>`;
        li.querySelector('button').addEventListener('click', () => removeDokumentasi(item));
        list.appendChild(li);
    });
}

async function removeDokumentasi(item) {
    if (!confirm(`Hapus dokumentasi "${item.judul}"?`)) return;
    if (item.foto_path) {
        await db.storage.from(STORAGE_BUCKET).remove([item.foto_path]);
    }
    const { error } = await db.from('dokumentasi').delete().eq('id', item.id);
    if (error) {
        alert('Gagal menghapus.');
        return;
    }
    loadDokumentasi();
}

// Aspirasi
async function loadAspirasi() {
    const { data, error } = await db.from('aspirasi').select('*').order('created_at', { ascending: false });
    const list = $('list-aspirasi');
    list.innerHTML = '';
    if (error) {
        list.innerHTML = '<li class="py-3 text-red-600">Gagal memuat aspirasi.</li>';
        return;
    }
    if (data.length === 0) {
        list.innerHTML = '<li class="py-3 text-slate-400">Belum ada aspirasi.</li>';
        return;
    }
    data.forEach(item => {
        const li = document.createElement('li');
        li.className = 'py-3 space-y-1';
        li.innerHTML = `
            <div class="flex justify-between items-center gap-4">
                <div class="font-semibold">${escapeHtml(item.nama)} <span class="font-normal text-slate-500">— ${escapeHtml(item.sekolah)}</span></div>
                <button class="text-red-600 hover:underline text-xs">Hapus</button>
            </div>
            <div class="text-xs text-emerald-700">${escapeHtml(item.kategori)} • ${new Date(item.created_at).toLocaleString('id-ID')}</div>
            <p class="text-slate-700">${escapeHtml(item.pesan)}</p>`;
        li.querySelector('button').addEventListener('click', () => removeAspirasi(item));
        list.appendChild(li);
    });
}

async function removeAspirasi(item) {
    if (!confirm('Hapus aspirasi ini?')) return;
    const { error } = await db.from('aspirasi').delete().eq('id', item.id);
    if (error) {
        alert('Gagal menghapus.');
        return;
    }
    loadAspirasi();
}

// Anggota
async function loadAnggota() {
    const { data, error } = await db.from('anggota').select('*').order('created_at', { ascending: false });
    const list = $('list-anggota');
    list.innerHTML = '';
    if (error) {
        list.innerHTML = '<li class="py-3 text-red-600">Gagal memuat anggota.</li>';
        return;
    }
    if (data.length === 0) {
        list.innerHTML = '<li class="py-3 text-slate-400">Belum ada anggota.</li>';
        return;
    }
    // Yang menunggu persetujuan ditampilkan paling atas
    data.sort((a, b) => a.disetujui - b.disetujui);
    data.forEach(item => {
        const li = document.createElement('li');
        li.className = 'py-3 flex justify-between items-center gap-4';
        li.innerHTML = `
            <div class="min-w-0">
                <div class="font-semibold break-words">${escapeHtml(item.nama)}
                    ${item.disetujui ? '' : '<span class="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">Menunggu</span>'}
                </div>
                <div class="text-xs text-slate-500">${escapeHtml(item.sekolah)} • ${escapeHtml(item.kelurahan)} • ${escapeHtml(item.gugus)} • ${escapeHtml(item.status)}</div>
            </div>
            <div class="flex gap-2 shrink-0">
                ${item.disetujui ? '' : '<button data-act="setujui" class="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">Setujui</button>'}
                <button data-act="hapus" class="px-3 py-2 rounded-lg text-red-600 border border-red-200 text-xs">Hapus</button>
            </div>`;
        li.querySelector('[data-act="hapus"]').addEventListener('click', () => removeAnggota(item));
        const btnSetujui = li.querySelector('[data-act="setujui"]');
        if (btnSetujui) btnSetujui.addEventListener('click', () => approveAnggota(item));
        list.appendChild(li);
    });
}

async function approveAnggota(item) {
    const { error } = await db.from('anggota').update({ disetujui: true }).eq('id', item.id);
    if (error) {
        alert('Gagal menyetujui.');
        return;
    }
    loadAnggota();
}

async function removeAnggota(item) {
    if (!confirm(`Hapus data anggota "${item.nama}"?`)) return;
    const { error } = await db.from('anggota').delete().eq('id', item.id);
    if (error) {
        alert('Gagal menghapus.');
        return;
    }
    loadAnggota();
}

init();
