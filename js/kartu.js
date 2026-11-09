// Kartu anggota: digambar di canvas (ukuran kartu KTP 85,6 × 54 mm) sehingga pratinjau
// dan hasil unduhan sama persis. NIP tidak dicantumkan.

const KARTU = { lebar: 1012, tinggi: 638 };
let kartuBlob = null;
let kartuNamaBerkas = 'kartu-anggota.png';

function muatGambar(src) {
    return new Promise(ok => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => ok(img);
        img.onerror = () => ok(null); // gambar gagal: kartu tetap dibuat tanpa gambar itu
        img.src = src;
    });
}

function nomorAnggota(a) {
    return `KKGPAI-CS-${String(a.id).padStart(4, '0')}`;
}

// Tulis teks satu baris; perkecil huruf bila terlalu panjang
function teksMuat(ctx, teks, x, y, lebarMaks, ukuran, tebal = '700', warna = '#0f172a') {
    let u = ukuran;
    do {
        ctx.font = `${tebal} ${u}px Inter, Arial, sans-serif`;
        u -= 1;
    } while (ctx.measureText(teks).width > lebarMaks && u > 14);
    ctx.fillStyle = warna;
    ctx.fillText(teks, x, y);
}

function kotakBulat(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

async function gambarKartu(a) {
    const { lebar: W, tinggi: H } = KARTU;
    const kanvas = document.createElement('canvas');
    kanvas.width = W;
    kanvas.height = H;
    const ctx = kanvas.getContext('2d');

    await document.fonts?.ready;
    const [logo, foto] = await Promise.all([
        muatGambar(logoPortal),
        a.foto_path ? muatGambar(publicUrl('foto-anggota', a.foto_path)) : Promise.resolve(null)
    ]);

    // Latar dan bingkai
    kotakBulat(ctx, 0, 0, W, H, 36);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);
    // Pola titik halus
    ctx.fillStyle = 'rgba(4, 120, 87, 0.06)';
    for (let x = 20; x < W; x += 28) for (let y = 190; y < H - 80; y += 28) ctx.fillRect(x, y, 3, 3);

    // Kepala hijau
    const hijau = ctx.createLinearGradient(0, 0, W, 170);
    hijau.addColorStop(0, '#047857');
    hijau.addColorStop(1, '#064e3b');
    ctx.fillStyle = hijau;
    ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 170, W, 8);

    if (logo) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(100, 85, 62, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.clip();
        ctx.drawImage(logo, 40, 25, 120, 120);
        ctx.restore();
    }
    teksMuat(ctx, 'KARTU ANGGOTA', 190, 72, W - 230, 44, '800', '#ffffff');
    teksMuat(ctx, 'KKG PAI SD Kecamatan Cimahi Selatan', 190, 115, W - 230, 28, '600', '#d1fae5');
    teksMuat(ctx, 'Kota Cimahi, Jawa Barat', 190, 148, W - 230, 20, '500', '#a7f3d0');

    // Foto atau inisial
    const fx = 50, fy = 215, fw = 230, fh = 290;
    kotakBulat(ctx, fx - 6, fy - 6, fw + 12, fh + 12, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    kotakBulat(ctx, fx, fy, fw, fh, 18);
    ctx.clip();
    if (foto) {
        // isi bingkai tanpa gepeng (seperti object-cover)
        const skala = Math.max(fw / foto.width, fh / foto.height);
        const w = foto.width * skala, h = foto.height * skala;
        ctx.drawImage(foto, fx + (fw - w) / 2, fy + (fh - h) / 2, w, h);
    } else {
        ctx.fillStyle = '#d1fae5';
        ctx.fillRect(fx, fy, fw, fh);
        const inisial = kunciNama(a.nama).split(/[\s,]+/).filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase();
        ctx.fillStyle = '#065f46';
        ctx.font = '800 96px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(inisial, fx + fw / 2, fy + fh / 2 + 34);
        ctx.textAlign = 'left';
    }
    ctx.restore();

    // Data anggota
    const x = 320, lebarTeks = W - x - 50;
    teksMuat(ctx, a.nama, x, 255, lebarTeks, 40, '800', '#064e3b');
    const baris = [
        ['Unit Kerja', a.sekolah],
        ['Gugus', a.gugus],
        ['Kelurahan', a.kelurahan],
        ['Status', `${a.status} • Sertifikasi: ${a.sertifikasi}`]
    ];
    baris.forEach(([label, isi], i) => {
        const y = 315 + i * 52;
        teksMuat(ctx, label.toUpperCase(), x, y - 22, lebarTeks, 16, '700', '#64748b');
        teksMuat(ctx, isi, x, y + 4, lebarTeks, 26, '600', '#1e293b');
    });

    // Kaki: nomor anggota
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, H - 72, W, 72);
    teksMuat(ctx, `No. Anggota: ${nomorAnggota(a)}`, 50, H - 27, 520, 26, '700', '#fbbf24');
    ctx.textAlign = 'right';
    teksMuat(ctx, 'KEREN dalam program, Nyata dalam pengabdian', W - 50, H - 29, 420, 18, '500', '#a7f3d0');
    ctx.textAlign = 'left';
    ctx.restore();

    return kanvas;
}

async function bukaKartu(id) {
    const a = dataAnggota.find(x => x.id === id);
    if (!a) return;
    const img = document.getElementById('kartu-gambar');
    img.classList.add('hidden');
    document.getElementById('kartu-memuat').classList.remove('hidden');
    document.getElementById('btn-unduh-kartu').disabled = true;
    document.getElementById('btn-bagikan-kartu').disabled = true;
    document.getElementById('modal-kartu').classList.remove('hidden');

    const kanvas = await gambarKartu(a);
    kartuNamaBerkas = `kartu-anggota-${kunciNama(a.nama).split(',')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    kanvas.toBlob(blob => {
        kartuBlob = blob;
        if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
        img.src = URL.createObjectURL(blob);
        img.alt = `Kartu anggota ${a.nama}`;
        img.classList.remove('hidden');
        document.getElementById('kartu-memuat').classList.add('hidden');
        document.getElementById('btn-unduh-kartu').disabled = false;
        // Tombol Bagikan hanya aktif di perangkat yang bisa membagikan berkas (umumnya HP)
        const berkas = new File([blob], kartuNamaBerkas, { type: 'image/png' });
        document.getElementById('btn-bagikan-kartu').disabled = !(navigator.canShare && navigator.canShare({ files: [berkas] }));
    }, 'image/png');
}

function tutupKartu() {
    document.getElementById('modal-kartu').classList.add('hidden');
}

function unduhKartu() {
    if (!kartuBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(kartuBlob);
    a.download = kartuNamaBerkas;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function bagikanKartu() {
    if (!kartuBlob) return;
    try {
        await navigator.share({ files: [new File([kartuBlob], kartuNamaBerkas, { type: 'image/png' })], title: 'Kartu Anggota KKG PAI SD' });
    } catch (err) {
        if (err.name !== 'AbortError') showToast('Gagal membagikan. Gunakan tombol Unduh.');
    }
}
