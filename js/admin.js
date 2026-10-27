const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);

function show(section) {
    ['sec-login', 'sec-upload', 'sec-list'].forEach(id => $(id).classList.toggle('hidden', id !== section && !(section === 'app' && id !== 'sec-login')));
    $('btn-logout').classList.toggle('hidden', section === 'sec-login');
}

async function init() {
    const { data } = await db.auth.getSession();
    if (data.session) {
        showApp();
    } else {
        show('sec-login');
    }
}

function showApp() {
    $('sec-login').classList.add('hidden');
    $('sec-upload').classList.remove('hidden');
    $('sec-list').classList.remove('hidden');
    $('btn-logout').classList.remove('hidden');
    loadList();
}

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
    showApp();
});

$('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    location.reload();
});

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
    loadList();
});

async function loadList() {
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
                <div class="font-semibold">${item.judul}</div>
                <div class="text-xs text-slate-500">${item.kategori} • ${item.tanggal} • ${item.lokasi}</div>
            </div>
            <button class="text-red-600 hover:underline text-xs">Hapus</button>`;
        li.querySelector('button').addEventListener('click', () => removeItem(item));
        list.appendChild(li);
    });
}

async function removeItem(item) {
    if (!confirm(`Hapus dokumentasi "${item.judul}"?`)) return;
    if (item.foto_path) {
        await db.storage.from(STORAGE_BUCKET).remove([item.foto_path]);
    }
    const { error } = await db.from('dokumentasi').delete().eq('id', item.id);
    if (error) {
        alert('Gagal menghapus.');
        return;
    }
    loadList();
}

init();
