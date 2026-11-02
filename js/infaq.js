// Laporan infaq (publik, hanya baca). Nama, sekolah, dan status diambil dari data anggota;
// centang TW dan keterangan dari tabel infaq; koordinator dari pengaturan.

const infaqData = { anggota: [], bayar: new Map(), urutanGugus: [], koordinator: {} };
const TW = ['tw1', 'tw2', 'tw3', 'tw4'];

function isiPilihanTahun() {
    const sel = document.getElementById('infaq-tahun');
    if (sel.options.length) return;
    for (let t = 2025; t <= 2030; t++) sel.add(new Option(t, t));
    sel.value = Math.min(Math.max(new Date().getFullYear(), 2025), 2030);
}

async function muatInfaq() {
    isiPilihanTahun();
    const tahun = Number(document.getElementById('infaq-tahun').value);
    const [anggota, bayar, peng] = await Promise.all([
        db.rpc('daftar_anggota_publik_v3'),
        db.from('infaq').select('*').eq('tahun', tahun),
        db.from('pengaturan').select('daftar_gugus, koordinator_gugus').eq('id', 1).single()
    ]);
    const galat = anggota.error || bayar.error || peng.error;
    if (galat) {
        console.error(galat);
        document.getElementById('infaq-kartu').innerHTML = pesanKosong('Laporan infaq gagal dimuat.');
        document.getElementById('infaq-tabel').innerHTML = `<tr><td colspan="11">${pesanKosong('Laporan infaq gagal dimuat.')}</td></tr>`;
        return;
    }
    infaqData.anggota = anggota.data;
    infaqData.bayar = new Map(bayar.data.map(b => [b.anggota_id, b]));
    infaqData.koordinator = peng.data.koordinator_gugus || {};
    // Urutan gugus mengikuti Pengaturan; gugus lama yang masih dipakai anggota ditaruh di akhir
    const lain = [...new Set(anggota.data.map(a => a.gugus))].filter(g => !peng.data.daftar_gugus.includes(g)).sort();
    infaqData.urutanGugus = [...peng.data.daftar_gugus, ...lain];

    const selGugus = document.getElementById('infaq-gugus');
    const dipilih = selGugus.value;
    selGugus.innerHTML = '<option value="">Semua Gugus</option>' +
        infaqData.urutanGugus.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
    selGugus.value = dipilih;
    renderInfaq();
}

function centang(sudah) {
    return sudah
        ? '<span class="inline-flex w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center" aria-label="Sudah"><i class="fa-solid fa-check"></i></span>'
        : '<span class="inline-flex w-7 h-7 rounded-full bg-slate-100 text-slate-400 items-center justify-center" aria-label="Belum"><i class="fa-solid fa-minus"></i></span>';
}

function renderInfaq() {
    const gugusPilih = document.getElementById('infaq-gugus').value;
    const cari = document.getElementById('infaq-cari').value.trim().toLowerCase();
    const cocok = a => (!gugusPilih || a.gugus === gugusPilih) &&
        (!cari || a.nama.toLowerCase().includes(cari) || a.sekolah.toLowerCase().includes(cari));
    const kelompok = infaqData.urutanGugus
        .map(g => ({ gugus: g, anggota: infaqData.anggota.filter(a => a.gugus === g && cocok(a)).sort(urutNama) }))
        .filter(k => k.anggota.length);
    const semua = kelompok.flatMap(k => k.anggota);

    // Ringkasan per triwulan untuk anggota yang sedang ditampilkan
    document.getElementById('infaq-ringkasan').innerHTML = TW.map((tw, i) => {
        const sudah = semua.filter(a => infaqData.bayar.get(a.id)?.[tw]).length;
        const persen = semua.length ? Math.round(sudah / semua.length * 100) : 0;
        return `<div class="bg-white rounded-2xl border border-slate-200 p-4">
            <p class="text-xs font-semibold text-slate-500">TW ${i + 1}</p>
            <p class="text-xl font-extrabold text-slate-900 mt-1">${sudah}<span class="text-sm font-semibold text-slate-400"> / ${semua.length}</span></p>
            <div class="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-emerald-500" style="width:${persen}%"></div></div>
        </div>`;
    }).join('');

    if (!semua.length) {
        const kosong = infaqData.anggota.length ? 'Tidak ada anggota yang cocok.' : 'Belum ada data anggota.';
        document.getElementById('infaq-kartu').innerHTML = pesanKosong(kosong);
        document.getElementById('infaq-tabel').innerHTML = `<tr><td colspan="11">${pesanKosong(kosong)}</td></tr>`;
        return;
    }

    let no = 0;
    // Tabel: kolom Gugus dan Koordinator digabung (rowspan) per gugus
    document.getElementById('infaq-tabel').innerHTML = kelompok.map(k => k.anggota.map((a, i) => {
        const b = infaqData.bayar.get(a.id) || {};
        no++;
        const kepala = i === 0
            ? `<td class="p-3 align-top font-semibold text-slate-800 border-r border-slate-100" rowspan="${k.anggota.length}">${escapeHtml(k.gugus)}</td>
               <td class="p-3 align-top border-r border-slate-100" rowspan="${k.anggota.length}">${escapeHtml(infaqData.koordinator[k.gugus] || '-')}</td>`
            : '';
        return `<tr class="border-b border-slate-100 ${i === 0 ? 'border-t-2 border-t-slate-200' : ''}">
            <td class="p-3">${no}</td>${kepala}
            <td class="p-3 font-semibold text-slate-800">${escapeHtml(a.nama)}</td>
            <td class="p-3">${escapeHtml(a.sekolah)}</td>
            <td class="p-3 whitespace-nowrap">${escapeHtml(a.status)}</td>
            ${TW.map(tw => `<td class="p-3 text-center">${centang(b[tw])}</td>`).join('')}
            <td class="p-3 text-xs">${escapeHtml(b.keterangan || '')}</td>
        </tr>`;
    }).join('')).join('');

    // HP: kartu per anggota, dikelompokkan per gugus
    no = 0;
    document.getElementById('infaq-kartu').innerHTML = kelompok.map(k => `
        <div>
            <div class="mb-2">
                <h3 class="font-bold text-slate-900">${escapeHtml(k.gugus)}</h3>
                <p class="text-xs text-slate-500">Koordinator: ${escapeHtml(infaqData.koordinator[k.gugus] || '-')}</p>
            </div>
            <div class="space-y-2">${k.anggota.map(a => {
                const b = infaqData.bayar.get(a.id) || {};
                no++;
                return `<div class="bg-white rounded-2xl border border-slate-200 p-4">
                    <div class="flex gap-3">
                        <span class="text-xs text-slate-400 w-6 shrink-0 pt-0.5 text-right">${no}</span>
                        <div class="min-w-0 flex-1">
                            <div class="font-bold text-slate-800 break-words">${escapeHtml(a.nama)}</div>
                            <div class="text-xs text-slate-500">${escapeHtml(a.sekolah)} • ${escapeHtml(a.status)}</div>
                            <div class="grid grid-cols-4 gap-2 mt-3">${TW.map((tw, i) => `
                                <div class="text-center"><div class="text-[11px] text-slate-500 mb-1">TW ${i + 1}</div>${centang(b[tw])}</div>`).join('')}
                            </div>
                            ${b.keterangan ? `<p class="text-xs text-slate-600 mt-2 break-words">Ket: ${escapeHtml(b.keterangan)}</p>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('')}</div>
        </div>`).join('');
}

const switchTabSebelumInfaq = switchTab;
switchTab = function (tabName) {
    switchTabSebelumInfaq(tabName);
    if (tabName === 'infaq') muatInfaq();
};
