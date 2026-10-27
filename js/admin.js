const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showTab(name) {
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + name));
    document.querySelectorAll('.admin-tab').forEach(b => {
        const active = b.dataset.tab === name;
        b.classList.toggle('bg-emerald-600', active);
        b.classList.toggle('text-white', active);
        b.classList.toggle('bg-white', !active);
        b.classList.toggle('text-slate-600', !active);
    });
    if (name === 'dokumentasi') loadDokumentasi();
    if (name === 'aspirasi') loadAspirasi();
    if (name === 'anggota') loadAnggota();
    if (name === 'akun') loadAkun();
}

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
    $('btn-logout').classList.toggle('hidden', !loggedIn);
    if (loggedIn) showTab('dokumentasi');
}

async function init() {
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
        status.innerText = 'Foto terunggah, tapi data gagal disimpan.';
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
    data.forEach(item => {
        const li = document.createElement('li');
        li.className = 'py-3 flex justify-between items-center gap-4';
        li.innerHTML = `
            <div>
                <div class="font-semibold">${escapeHtml(item.nama)}</div>
                <div class="text-xs text-slate-500">${escapeHtml(item.sekolah)} • ${escapeHtml(item.kelurahan)} • ${escapeHtml(item.gugus)} • ${escapeHtml(item.status)}</div>
            </div>
            <button class="text-red-600 hover:underline text-xs">Hapus</button>`;
        li.querySelector('button').addEventListener('click', () => removeAnggota(item));
        list.appendChild(li);
    });
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
