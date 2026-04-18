# Meta Ads Integration Master

Dokumen master untuk fitur integrasi otomatis ke Meta Ads.
Status: `In Progress`  
Terakhir update: `2026-04-17`

## 1) Tujuan
- Saat status iklan menjadi `KONTEN_SELESAI`, sistem otomatis membuat draft Meta Ads:
  - `1 Campaign`
  - `1 Ad Set`
  - `4 Ads`
- Draft dibuat agar Advertiser tinggal review, koreksi, dan upload konten final di Ads Manager.
- Sistem mendukung 2 mode:
  - `Generate Draft`: membuat campaign/adset/ad dari nol.
  - `Duplicate Campaign`: duplikasi campaign template lalu penyesuaian data request.

## 2) Keputusan Final (Disepakati)

### 2.1 Objective
- Objective campaign: `SALES`.

### 2.2 Struktur Ad
- `Ad 1 - Ad 3`: tipe `JJ`
- `Ad 4`: tipe `VO`

### 2.3 Trigger
- Trigger utama: saat status menjadi `KONTEN_SELESAI`.
- Wajib idempotent (tidak membuat draft ganda untuk request yang sama).

### 2.4 Naming Convention
- Campaign Name: `{city} {date} - {nama promotor}`
- Campaign Name (versi sinkron otomatis): `{city} {date} - {nama promotor} [{campaignCode}]`
- Ad Set Name: `Ad Set - {city} {date}`
- Ad Name:
  - `{city} - Ad 1`
  - `{city} - Ad 2`
  - `{city} - Ad 3`
  - `{city} - Ad 4`

### 2.5 Budget Rule
- Gunakan `Campaign Budget`.
- Tipe budget: `Lifetime Budget`.
- Nilai budget: dari `nominal budget iklan` di aplikasi.

### 2.6 Schedule Rule
- Timezone: `Asia/Jakarta`.
- Jadwal mengikuti logika aplikasi (start/end date yang sudah dipakai di sistem).

### 2.9 Rule Nomor WhatsApp CTWA
- Jika mode `META_AD_DESTINATION=WHATSAPP`, sistem memakai nomor WhatsApp milik promotor (`user.phone`) secara otomatis.
- Format nomor dinormalisasi ke format internasional Indonesia (`62xxxxxxxxxx`).
- Jika nomor promotor kosong/tidak valid, sistem fallback ke `META_WHATSAPP_NUMBER` (jika diisi).

### 2.7 Creative Text Rule
- Setiap Ad menggunakan:
  - `5 caption (Primary Text)`
  - `5 headline`
  - `1 description`
- Berlaku untuk ad `JJ` dan `VO`.
- Placeholder template yang didukung:
  - `{city}`, `{promotor}`
  - `{day}` (nama hari)
  - `{tanggal}` (angka tanggal saja, contoh `26`)
  - `{month}` (nama bulan)
  - `{year}` (tahun)
  - `{date}` atau `{date_full}` (format lengkap: `26 April 2026`)

### 2.10 Keputusan Implementasi CTWA (17 Apr 2026)
- Identity IG tidak dipaksa via actor ID; mengikuti pengaturan fanpage.
- Nomor WhatsApp adset prioritaskan nomor promotor.
- Jika nomor promotor ditolak Meta (mis. belum terhubung ke page/WABA), sistem otomatis fallback ke nomor default:
  - `+62 812-2011-519` (`META_WHATSAPP_NUMBER`).

### 2.8 Dashboard Advertiser
- Tambah fitur input template caption/headline/description di dashboard Advertiser.

## 3) Kebutuhan Integrasi Meta (Teknis)
- Meta App (Facebook Developer) + Marketing API.
- Business Manager + Ad Account terhubung.
- System User + access token.
- Permission minimal:
  - `ads_management`
  - `ads_read`
  - `business_management`

## 4) Environment Variables (Rencana)
- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID` (format: `act_xxx`)
- `META_PAGE_ID`
- `META_INSTAGRAM_ACTOR_ID` (opsional, jika pakai IG actor)
- `META_API_VERSION` (mis. `v23.0`, bisa diubah sesuai versi stabil)
- `META_AD_DESTINATION` (`WHATSAPP` atau `WEBSITE`)
- `META_WHATSAPP_NUMBER` (wajib jika `META_AD_DESTINATION=WHATSAPP`)
- `AUTO_CREATE_ADSET_WITHOUT_WA` (opsional, `true/false`, mode uji bypass CTWA)
- `META_TEMPLATE_CAMPAIGN_ID` (wajib jika mode `DUPLICATE`)
- `META_PIXEL_ID` (wajib jika `META_AD_DESTINATION=WEBSITE`)
- `META_DESTINATION_URL` (wajib jika `META_AD_DESTINATION=WEBSITE`)

## 5) Data Model / Persistensi (Rencana)
- Simpan metadata draft per ad request:
  - `campaignCode` (kode unik pengajuan, immutable, untuk auto-link sync)
  - `metaCampaignId`
  - `metaAdSetId`
  - `metaAdIds` (array/string list)
  - `metaDraftStatus` (`PENDING | SUCCESS | PARTIAL | FAILED`)
  - `metaDraftError` (nullable)
  - `metaDraftCreatedAt`
  - `metaDraftUpdatedAt`
- Tambah guard idempotency:
  - jika `metaCampaignId` sudah ada, skip create otomatis.

## 6) Alur Implementasi (Rencana)
1. Endpoint/service untuk generate draft Meta dari 1 ad request.
2. Hook trigger saat status masuk `KONTEN_SELESAI`.
3. Builder payload:
   - campaign (sales + lifetime budget)
   - adset (schedule Jakarta)
   - 4 ad sesuai format naming
   - attach 5 primary text + 5 headline + 1 description.
4. Simpan ID Meta ke DB.
5. Tampilkan status draft di dashboard Advertiser.
6. Tambahkan menu manajemen template caption/headline/description.
7. Tambahkan retry manual: `Generate Ulang Draft Meta`.

## 7) Checklist Progres
- [x] Tambah skema DB untuk metadata Meta draft.
- [x] Tambah service client Meta API.
- [x] Implement create Campaign draft.
- [x] Implement create Ad Set draft.
- [x] Implement create 4 Ads draft (JJ, JJ, JJ, VO).
- [x] Mapping lifetime budget dari nominal budget iklan.
- [x] Mapping schedule Asia/Jakarta.
- [x] Mapping 5 caption + 5 headline + 1 description per Ad.
- [x] Trigger otomatis saat `KONTEN_SELESAI`.
- [x] Guard idempotency agar tidak duplikat.
- [x] UI status draft Meta di dashboard Advertiser.
- [x] UI input template caption/headline/description.
- [x] Tombol retry manual generate draft.
- [x] Logging + error handling terstruktur.
- [ ] Dokumentasi cara setup token/permission Meta.

## 9) Update Implementasi 17 Apr 2026
- Ditambahkan service `src/lib/meta-ads.ts` untuk:
  - Test koneksi Meta
  - Simpan/ambil template teks ads
  - Generate draft campaign, adset, dan 4 ads
  - Simpan status/error ke kolom `metaDraft*`
- Ditambahkan API:
  - `GET /api/meta/test`
  - `GET/POST /api/meta/templates`
  - `POST /api/ad-requests/[id]/meta-draft` (retry manual)
- Trigger otomatis saat upload konten selesai:
  - `POST /api/ad-requests/[id]/upload-content` memanggil generate draft Meta
- UI Advertiser:
  - Tab baru `Meta Ads`
  - Form 5 primary texts, 5 headlines, 1 description
  - Tombol `Tes Koneksi Meta`
  - Daftar status draft per pengajuan + tombol `Generate Ulang Draft Meta`

## 8) Catatan Implementasi
- Draft Meta disarankan dibuat dengan status `PAUSED`.
- Jika API gagal, proses bisnis utama aplikasi tidak boleh terhenti.
- Semua error integrasi harus muncul jelas di dashboard (agar mudah follow-up).
- Mode fallback aktif:
  - Jika Campaign berhasil dibuat tetapi Ad Set/Ads gagal, status disimpan sebagai `PARTIAL`.
  - `Campaign ID` tetap disimpan agar advertiser bisa lanjut manual di Ads Manager.
- Mode uji opsional:
  - Saat `AUTO_CREATE_ADSET_WITHOUT_WA=true` dan destination utama `WHATSAPP`, sistem memakai fallback otomatis (objective traffic + website destination) agar auto-create Ad Set/Ads tetap bisa diuji walau asset WA belum siap.
