// Lihat berkas perangkat ajar di dalam web sebelum diunduh.
// PDF digambar dengan pdf.js (HP Android tidak punya penampil PDF bawaan, jadi tanpa ini langsung terunduh).
// Word/Excel/PowerPoint ditampilkan lewat penampil Microsoft Office Online (berkasnya publik).

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
const EKSTENSI_OFFICE = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
let tugasPdf = 0; // menghentikan gambar halaman PDF lama bila berkas lain dibuka

// Tautan unduh: Supabase mengirim berkas sebagai lampiran bila ada parameter ?download
function urlUnduh(path) {
    const nama = path.replace(/^\d+-/, ''); // buang awalan angka dari nama berkas
    return db.storage.from('perangkat-ajar').getPublicUrl(path, { download: nama }).data.publicUrl;
}

function muatPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise((ok, gagal) => {
        const sc = document.createElement('script');
        sc.src = PDFJS + 'pdf.min.js';
        sc.onload = () => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
            ok();
        };
        sc.onerror = () => gagal(new Error('Penampil PDF gagal dimuat.'));
        document.head.appendChild(sc);
    });
}

function pesanBerkas(teks) {
    document.getElementById('berkas-isi').innerHTML =
        `<p class="text-center text-sm text-slate-600 bg-white rounded-xl m-4 p-6">${escapeHtml(teks)}</p>`;
}

async function lihatBerkas(id) {
    const item = dataPerangkat.find(x => x.id === id);
    if (!item?.file_path) return;
    const url = publicUrl('perangkat-ajar', item.file_path);
    const ext = item.file_path.split('.').pop().toLowerCase();

    document.getElementById('berkas-judul').innerText = item.judul;
    document.getElementById('berkas-unduh').href = urlUnduh(item.file_path);
    document.getElementById('modal-berkas').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const isi = document.getElementById('berkas-isi');

    if (EKSTENSI_OFFICE.includes(ext)) {
        isi.innerHTML = `<iframe title="${escapeHtml(item.judul)}" class="w-full h-full bg-white border-0"
            src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}"></iframe>`;
        return;
    }
    if (ext !== 'pdf') {
        pesanBerkas('Berkas jenis ini tidak bisa ditampilkan di web. Silakan gunakan tombol Unduh.');
        return;
    }

    const tugas = ++tugasPdf;
    pesanBerkas('Memuat PDF...');
    try {
        await muatPdfJs();
        const pdf = await pdfjsLib.getDocument(url).promise;
        if (tugas !== tugasPdf) return;
        isi.innerHTML = '<div id="berkas-halaman" class="flex flex-col items-center gap-3 p-3"></div>';
        const wadah = document.getElementById('berkas-halaman');
        const lebar = Math.min(isi.clientWidth - 24, 900);
        const rasio = Math.min(window.devicePixelRatio || 1, 2);
        // Halaman digambar berurutan agar halaman pertama cepat tampil
        for (let n = 1; n <= pdf.numPages; n++) {
            const hal = await pdf.getPage(n);
            if (tugas !== tugasPdf) return;
            const skala = lebar / hal.getViewport({ scale: 1 }).width;
            const vp = hal.getViewport({ scale: skala * rasio });
            const kanvas = document.createElement('canvas');
            kanvas.width = vp.width;
            kanvas.height = vp.height;
            kanvas.style.width = `${vp.width / rasio}px`;
            kanvas.className = 'bg-white shadow max-w-full h-auto';
            kanvas.setAttribute('aria-label', `Halaman ${n} dari ${pdf.numPages}`);
            wadah.appendChild(kanvas);
            await hal.render({ canvasContext: kanvas.getContext('2d'), viewport: vp }).promise;
        }
    } catch (err) {
        console.error(err);
        if (tugas === tugasPdf) pesanBerkas('PDF gagal ditampilkan. Silakan gunakan tombol Unduh.');
    }
}

function tutupBerkas() {
    tugasPdf++;
    document.getElementById('modal-berkas').classList.add('hidden');
    document.getElementById('berkas-isi').innerHTML = '';
    document.body.style.overflow = '';
}
