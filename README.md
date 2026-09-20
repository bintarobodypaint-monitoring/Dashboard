# DIGITAL MONITORING SYSTEM — TUNAS TOYOTA BINTARO — READY V3

Frontend modular untuk GitHub Pages.

## Login
Login global satu kali per browser (12 jam) menggunakan localStorage; tombol LOGOUT tersedia di dashboard dan setiap modul. Ini adalah client-side gating, bukan autentikasi server-side.

## API dipertahankan
- JPCB / Dashboard API: existing endpoint dari baseline.
- REDO API: existing endpoint dari baseline.
- QC REPORT API: existing endpoint dari baseline; QC frontend menggunakan JSONP karena API mendukung callback.
- JSCB: menggunakan baseline `JSCB_JPCB_V35_PROCESS_MAPPING_FIX-2` yang ditemukan di Library, termasuk endpoint dan local controller state yang ada di file tersebut.

## Struktur
`index.html` = dashboard/login. `pages/` = modul terpisah. `js/` = engine/API adapters. `css/` = shared style. `assets/` = logo + denah.

## Deploy
Upload isi folder ini ke root repository GitHub Pages.


## DENAH BODY & PAINT
Denah menggunakan file yang diunggah: `DOC-20260912-WA0086.pdf` (LAYOUT BINTARO BODY & PAINT). Versi PNG HD tersedia di `assets/` untuk ditampilkan pada halaman Denah, dan PDF asli disimpan sebagai referensi.
