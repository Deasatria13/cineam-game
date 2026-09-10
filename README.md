# Deception: Murder in Cineam

Game social deduction berbasis room, dikonversi dari artifact Claude jadi
project React (Vite) biasa, siap di-deploy ke Vercel. Data room disimpan di
**Firebase Realtime Database** supaya semua pemain tetap sinkron.

## 1. Jalankan di lokal

```bash
npm install
cp .env.example .env   # lalu isi dengan kredensial Firebase (lihat langkah 2)
npm run dev
```

## 2. Setup Firebase (gratis)

1. Buka https://console.firebase.google.com → **Add project** → beri nama
   bebas (mis. `cineam-game`) → lanjutkan (Google Analytics boleh dimatikan).
2. Di sidebar kiri, klik **Build > Realtime Database** → **Create Database**
   → pilih lokasi server (mis. Singapore) → mulai dalam **test mode**
   (nanti kita perketat aturan di langkah 4).
3. Balik ke **Project Overview** → klik ikon **</>** (Web) untuk mendaftarkan
   web app → beri nama app → **Register app**. Firebase akan menampilkan
   objek `firebaseConfig` seperti ini:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "cineam-game.firebaseapp.com",
     databaseURL: "https://cineam-game-default-rtdb.asia-southeast1.firebasedatabase.app",
     projectId: "cineam-game",
     storageBucket: "cineam-game.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef",
   };
   ```

4. Salin tiap nilai itu ke file `.env` kamu (nama variabelnya sudah cocok
   di `.env.example`, tinggal isi).

5. **Penting — atur Rules Realtime Database** supaya orang lain nggak bisa
   iseng baca/tulis room orang lain sembarangan. Buka tab **Rules** di
   Realtime Database, dan minimal pakai ini untuk mulai (boleh diperketat
   lagi nanti):

   ```json
   {
     "rules": {
       "rooms": {
         "$code": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```

   Ini masih terbuka (siapa saja yang tahu kode room bisa baca/tulis room
   itu) — cukup untuk game santai. Kalau mau lebih aman, bisa ditambah
   Firebase Authentication + rules berbasis auth, tapi itu di luar cakupan
   konversi ini.

## 3. Deploy ke Vercel (gratis)

1. Push folder project ini ke repository GitHub baru.
2. Buka https://vercel.com → **Add New… > Project** → import repo GitHub
   tadi.
3. Vercel otomatis mendeteksi framework **Vite**. Sebelum klik Deploy,
   buka bagian **Environment Variables** dan masukkan 7 variabel yang sama
   persis dari file `.env` kamu (`VITE_FIREBASE_API_KEY`, dst).
4. Klik **Deploy**. Setelah selesai, kamu dapat URL publik seperti
   `nama-project.vercel.app` — itu bisa langsung dibagikan ke teman-teman
   untuk main bareng.

## Catatan

- Game ini butuh 4–12 pemain dan diskusi suara di luar aplikasi (voice call
  Discord/WA/dsb) — aplikasi ini hanya mengatur papan petunjuk, kartu, dan
  giliran bicara.
- Update data room saat ini masih memakai polling tiap ~2.2 detik (lihat
  `getRoom` di `src/App.jsx`). Ini sudah cukup untuk gameplay, tapi kalau
  mau lebih real-time, bisa diganti pakai `onValue` listener dari
  `firebase/database` dan menghapus interval polling-nya.
