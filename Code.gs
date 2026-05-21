/**
 * ================================================================
 *  SISTEM PENDAFTARAN KURSUS — Google Apps Script
 *  Versi: 2.0 (dengan Kuis + Edit Materi)
 * ================================================================
 *
 *  CARA DEPLOY (baca sekali, ikuti urutan):
 *
 *  1. Buka script.google.com → New Project → beri nama
 *  2. Hapus semua kode default, paste seluruh file ini
 *  3. Isi KONFIGURASI di bawah (SPREADSHEET_ID wajib)
 *  4. Klik Run → pilih fungsi "setupSpreadsheet" → izinkan akses
 *     (ini buat struktur Sheet otomatis, cukup sekali)
 *  5. Deploy → New Deployment → Web App
 *       Execute as : Me
 *       Who access : Anyone
 *  6. Klik Deploy → salin URL deployment
 *  7. Paste URL ke CONFIG.scriptUrl di ketiga file HTML
 *
 * ================================================================
 */

// ================================================================
//  KONFIGURASI — wajib diisi sebelum deploy
// ================================================================
const SPREADSHEET_ID = '19LxrqOEJTRQpVOPP3ZrkF10NE396A_KzuTtrsk_2eng';
const ADMIN_EMAIL    = 'pelajariapp@gmail.com';
const BRAND_NAME     = 'Pelajari';
const PORTAL_URL     = 'https://faridadamn.github.io/pelajari/index.html';

// Nama tab Sheet (jangan diubah kecuali perlu)
const SH = {
  PENDAFTAR : 'Pendaftar',
  KURSUS    : 'Kursus',
  MATERI    : 'Materi',
  AKSES     : 'Akses',
  CHAT_THREADS  : 'ChatThreads',
  CHAT_MESSAGES : 'ChatMessages',
};

// Header tiap sheet — urutan kolom ini PENTING
const HEADERS = {
  PENDAFTAR : ['ID','Timestamp','Nama','Email','WhatsApp','Kota','Kursus ID','Kursus Nama','Pekerjaan','Sumber','Tujuan','Total Bayar','Catatan','Status','Token Akses','Tgl Verifikasi','File Bukti'],
  KURSUS    : ['ID','Emoji','Theme','Kategori','Nama','Deskripsi','Jumlah Modul','Lama Akses','Harga','Harga Asli'],
  MATERI    : ['Kursus ID','Modul No','Judul','Section','Durasi (mnt)','URL Video','URL PDF','Teks Konten','Terkunci','Quiz JSON'],
  AKSES     : ['Email','Nama','Kursus ID','Kursus Nama','Token','Tgl Kadaluarsa','Progress JSON','Tgl Dibuat'],
  CHAT_THREADS  : ['Thread ID','Email Siswa','Nama Siswa','Kursus ID','Kursus Nama','Status','Last Message','Last Message At','Unread Admin','Unread Siswa','Created At'],
  CHAT_MESSAGES : ['Message ID','Thread ID','Sender','Sender Name','Message','Timestamp','Read At'],
};


// ================================================================
//  ROUTER GET
// ================================================================
function doGet(e) {
  const action = (e.parameter.action || '').trim();
  try {
    switch(action) {
      case 'getCourses'  : return json(getCourses());
      case 'getAll'      : return json(getAllPendaftar());
      case 'getMateri'   : return json(getMateri(e.parameter.kursusId));
      case 'checkAccess' : return json(checkAccess(e.parameter.email, e.parameter.token));
      case 'getChatThreads'  : return json(getChatThreads(e.parameter.email));
      case 'getChatMessages' : return json(getChatMessages(e.parameter.threadId, e.parameter.email));
      default            : return json({ status:'ok', brand:BRAND_NAME, version:'2.0' });
    }
  } catch(err) {
    Logger.log(err);
    return json({ error: err.message });
  }
}


// ================================================================
//  ROUTER POST
// ================================================================
function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = (data.action || '').trim();
    switch(action) {
      case 'register'       : return json(handleRegister(data));
      case 'updateStatus'   : return json(handleUpdateStatus(data));
      case 'saveMateri'     : return json(handleSaveMateri(data));
      case 'updateProgress' : return json(handleUpdateProgress(data));
      case 'sendChatMessage': return json(handleSendChatMessage(data));
      case 'markChatRead'   : return json(handleMarkChatRead(data));
      case 'closeChatThread': return json(handleCloseChatThread(data));
      default               : return json({ error: 'Unknown action: ' + action });
    }
  } catch(err) {
    Logger.log(err);
    return json({ error: err.message });
  }
}


// ================================================================
//  HANDLER: REGISTRASI PENDAFTAR BARU
// ================================================================
function handleRegister(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, SH.PENDAFTAR, HEADERS.PENDAFTAR);

  const token = generateToken();
  const id    = data.nomorPendaftaran || ('REG-' + Date.now());
  const row   = [
    id,
    data.timestamp || now(),
    data.nama        || '',
    data.email       || '',
    data.wa          || '',
    data.kota        || '',
    data.kursus      || '',
    data.kursusNama  || data.kursus || '',
    data.pekerjaan   || '',
    data.sumber      || '',
    data.tujuan      || '',
    data.totalBayar  || '',
    data.catatan     || '',
    'pending',
    token,
    '',
    '',
  ];

  sheet.appendRow(row);
  formatHeader(sheet);

  // Simpan bukti ke Drive
  if (data.buktiBase64 && data.buktiNama) {
    try {
      const folder = getOrCreateFolder('Bukti Transfer — ' + BRAND_NAME);
      const b64    = data.buktiBase64.includes(',') ? data.buktiBase64.split(',')[1] : data.buktiBase64;
      const ext    = data.buktiNama.split('.').pop().toLowerCase();
      const mime   = ext === 'pdf' ? 'application/pdf' : 'image/jpeg';
      const blob   = Utilities.newBlob(Utilities.base64Decode(b64), mime, id + '_bukti.' + ext);
      const file   = folder.createFile(blob);
      const lastR  = sheet.getLastRow();
      sheet.getRange(lastR, 17).setValue(file.getUrl()); // kolom File Bukti
    } catch(err) {
      Logger.log('Gagal simpan file: ' + err.message);
    }
  }

  emailKonfirmasiPendaftar(data.email, data.nama, data.kursusNama || data.kursus, id, data.totalBayar);
  emailNotifAdmin(data, id);

  return { success:true, id, message:'Pendaftaran berhasil' };
}


// ================================================================
//  HANDLER: UPDATE STATUS (VERIFIKASI / TOLAK)
// ================================================================
function handleUpdateStatus(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SH.PENDAFTAR);
  if (!sheet) return { error: 'Sheet Pendaftar tidak ditemukan' };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      const token      = rows[i][14];
      const email      = rows[i][3];
      const nama       = rows[i][2];
      const kursusId   = rows[i][6];
      const kursusNama = rows[i][7];

      sheet.getRange(i + 1, 14).setValue(data.status);
      sheet.getRange(i + 1, 16).setValue(now());

      if (data.status === 'verified') {
        addToAkses(email, nama, kursusId, kursusNama, token);
        emailAksesSiswa(email, nama, kursusNama, token);
      } else if (data.status === 'rejected') {
        emailDitolak(email, nama, kursusNama);
      }

      return { success:true, status:data.status };
    }
  }
  return { error:'Data tidak ditemukan: ' + data.id };
}


// ================================================================
//  HANDLER: SIMPAN / UPDATE MATERI MODUL (dari admin editor)
// ================================================================
function handleSaveMateri(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, SH.MATERI, HEADERS.MATERI);
  const m     = data.modul;
  if (!m || !data.kursusId) return { error:'Data tidak lengkap' };

  const rows     = sheet.getDataRange().getValues();
  const kursusId = String(data.kursusId);
  const modulNo  = parseInt(m.id);

  // Cari baris yang sudah ada (update) atau tambah baru
  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === kursusId && parseInt(rows[i][1]) === modulNo) {
      targetRow = i + 1; break;
    }
  }

  const quizJson = JSON.stringify(m.quiz || []);
  const rowData  = [
    kursusId,
    modulNo,
    m.judul     || '',
    m.section   || '',
    m.durasi    || '',
    m.videoUrl  || '',
    m.pdfUrl    || '',
    m.teks      || '',
    m.terkunci  ? 'TRUE' : 'FALSE',
    quizJson,
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { success:true, message:'Modul ' + modulNo + ' disimpan' };
}


// ================================================================
//  HANDLER: UPDATE PROGRESS BELAJAR SISWA
// ================================================================
function handleUpdateProgress(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SH.AKSES);
  if (!sheet) return { error:'Sheet Akses tidak ditemukan' };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toLowerCase() === (data.email || '').toLowerCase()) {
      let prog = [];
      try { prog = JSON.parse(rows[i][6] || '[]'); } catch(e) {}
      if (!prog.includes(data.moduleId)) prog.push(data.moduleId);
      sheet.getRange(i + 1, 7).setValue(JSON.stringify(prog));
      return { success:true };
    }
  }
  return { error:'User tidak ditemukan' };
}


// ================================================================
//  GET: DATA KURSUS
// ================================================================
function getCourses() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SH.KURSUS);
  if (!sheet) return { courses:[] };

  const rows = sheet.getDataRange().getValues();
  const courses = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    courses.push({
      id      : r[0],  emoji : r[1] || '📚',
      theme   : r[2] || 'thumb-t1',
      cat     : r[3] || 'Kursus',
      name    : r[4],  desc  : r[5] || '',
      tags    : [r[6] || '10 modul', r[7] || '3 bln akses'],
      harga   : parseInt(r[8])  || 0,
      ori     : parseInt(r[9])  || 0,
    });
  }
  return { courses };
}


// ================================================================
//  GET: SEMUA PENDAFTAR (untuk admin dashboard)
// ================================================================
function getAllPendaftar() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SH.PENDAFTAR);
  if (!sheet) return { pendaftar:[] };

  const rows = sheet.getDataRange().getValues();
  const pendaftar = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    pendaftar.push({
      id:r[0], tanggal:r[1], nama:r[2], email:r[3],
      wa:r[4],  kota:r[5],   kursus:r[7], pekerjaan:r[8],
      sumber:r[9], tujuan:r[10], nominal:r[11],
      status:r[13], fileBukti:r[16] || '',
    });
  }
  return { pendaftar };
}


// ================================================================
//  GET: MATERI KURSUS (untuk admin editor & portal belajar)
// ================================================================
function getMateri(kursusId) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SH.MATERI);
  if (!sheet) return { materi:[] };

  const rows   = sheet.getDataRange().getValues();
  const materi = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || (kursusId && String(r[0]) !== String(kursusId))) continue;
    let quiz = [];
    try { quiz = JSON.parse(r[9] || '[]'); } catch(e) {}
    materi.push({
      kursusId : r[0],
      id       : parseInt(r[1]),
      judul    : r[2],   section  : r[3],
      durasi   : r[4],   videoUrl : r[5],
      pdfUrl   : r[6],   teks     : r[7],
      terkunci : r[8] === 'TRUE',
      quiz,
    });
  }
  materi.sort((a,b) => a.id - b.id);
  return { materi };
}


// ================================================================
//  GET: CEK AKSES SISWA (login portal)
// ================================================================
function checkAccess(email, token) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SH.AKSES);
  if (!sheet) return { valid:false };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[0].toLowerCase() !== (email||'').toLowerCase()) continue;
    if (r[4] !== (token||'').toUpperCase()) continue;

    const exp = new Date(r[5]);
    if (exp < new Date()) return { valid:false, reason:'expired' };

    let progress = [];
    try { progress = JSON.parse(r[6] || '[]'); } catch(e) {}

    return {
      valid : true,
      user  : {
        email    : r[0],
        nama     : r[1],
        kursusId : r[2],
        kursus   : r[3],
        expDate  : exp.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}),
        progress,
      }
    };
  }
  return { valid:false };
}

// ================================================================
//  CHAT SISWA - ADMIN
// ================================================================
function getChatThreads(email) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, SH.CHAT_THREADS, HEADERS.CHAT_THREADS);
  const rows  = sheet.getDataRange().getValues();
  const filterEmail = (email || '').toLowerCase();
  const threads = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    if (filterEmail && String(r[1]).toLowerCase() !== filterEmail) continue;
    threads.push({
      id          : r[0],
      email       : r[1],
      nama        : r[2],
      kursusId    : r[3],
      kursus      : r[4],
      status      : r[5] || 'open',
      lastMessage : r[6] || '',
      lastAt      : r[7] || '',
      unreadAdmin : Number(r[8]) || 0,
      unreadSiswa : Number(r[9]) || 0,
      createdAt   : r[10] || '',
    });
  }

  threads.sort((a,b) => new Date(b.lastAt || b.createdAt) - new Date(a.lastAt || a.createdAt));
  return { threads };
}

function getChatMessages(threadId, email) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const thread = findChatThread_(ss, threadId, email);
  if (!thread) return { thread:null, messages:[] };

  const sheet = getOrCreateSheet(ss, SH.CHAT_MESSAGES, HEADERS.CHAT_MESSAGES);
  const rows  = sheet.getDataRange().getValues();
  const messages = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[1] !== thread.id) continue;
    messages.push({
      id         : r[0],
      threadId   : r[1],
      sender     : r[2],
      senderName : r[3],
      message    : r[4],
      timestamp  : r[5],
      readAt     : r[6] || '',
    });
  }

  return { thread, messages };
}

function handleSendChatMessage(data) {
  const message = String(data.message || '').trim();
  if (!message) return { error:'Pesan kosong' };
  if (message.length > 2000) return { error:'Pesan terlalu panjang' };

  const sender = data.sender === 'admin' ? 'admin' : 'siswa';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const threadSheet = getOrCreateSheet(ss, SH.CHAT_THREADS, HEADERS.CHAT_THREADS);
    const msgSheet    = getOrCreateSheet(ss, SH.CHAT_MESSAGES, HEADERS.CHAT_MESSAGES);
    let thread = findChatThread_(ss, data.threadId, data.email);
    let threadRow = thread ? thread.row : -1;
    const ts = chatNow_();

    if (!thread) {
      const id = 'CHAT-' + Date.now();
      const row = [
        id,
        data.email || '',
        data.nama || '',
        data.kursusId || '',
        data.kursus || '',
        'open',
        message,
        ts,
        sender === 'siswa' ? 1 : 0,
        sender === 'admin' ? 1 : 0,
        ts,
      ];
      threadSheet.appendRow(row);
      threadRow = threadSheet.getLastRow();
      thread = {
        id:id, email:row[1], nama:row[2], kursusId:row[3], kursus:row[4],
        status:row[5], lastMessage:row[6], lastAt:row[7],
        unreadAdmin:row[8], unreadSiswa:row[9], createdAt:row[10], row:threadRow
      };
    } else {
      const unreadAdmin = sender === 'siswa' ? (Number(thread.unreadAdmin) || 0) + 1 : 0;
      const unreadSiswa = sender === 'admin' ? (Number(thread.unreadSiswa) || 0) + 1 : 0;
      threadSheet.getRange(threadRow, 6, 1, 5).setValues([['open', message, ts, unreadAdmin, unreadSiswa]]);
      thread.status = 'open';
      thread.lastMessage = message;
      thread.lastAt = ts;
      thread.unreadAdmin = unreadAdmin;
      thread.unreadSiswa = unreadSiswa;
    }

    const messageId = 'MSG-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    msgSheet.appendRow([messageId, thread.id, sender, data.senderName || (sender === 'admin' ? 'Admin' : data.nama || 'Siswa'), message, ts, '']);
    return { success:true, threadId:thread.id, thread };
  } finally {
    lock.releaseLock();
  }
}

function handleMarkChatRead(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const thread = findChatThread_(ss, data.threadId, data.email);
  if (!thread) return { success:true };

  const sheet = getOrCreateSheet(ss, SH.CHAT_THREADS, HEADERS.CHAT_THREADS);
  if (data.reader === 'admin') {
    sheet.getRange(thread.row, 9).setValue(0);
  } else {
    sheet.getRange(thread.row, 10).setValue(0);
  }
  return { success:true };
}

function handleCloseChatThread(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const thread = findChatThread_(ss, data.threadId, data.email);
  if (!thread) return { error:'Percakapan tidak ditemukan' };

  const sheet = getOrCreateSheet(ss, SH.CHAT_THREADS, HEADERS.CHAT_THREADS);
  sheet.getRange(thread.row, 6).setValue('closed');
  return { success:true };
}

function findChatThread_(ss, threadId, email) {
  const sheet = getOrCreateSheet(ss, SH.CHAT_THREADS, HEADERS.CHAT_THREADS);
  const rows  = sheet.getDataRange().getValues();
  const wantedId = String(threadId || '');
  const wantedEmail = String(email || '').toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    if (wantedId && r[0] !== wantedId) continue;
    if (!wantedId && wantedEmail && String(r[1]).toLowerCase() !== wantedEmail) continue;
    if (!wantedId && !wantedEmail) continue;
    return {
      id          : r[0],
      email       : r[1],
      nama        : r[2],
      kursusId    : r[3],
      kursus      : r[4],
      status      : r[5] || 'open',
      lastMessage : r[6] || '',
      lastAt      : r[7] || '',
      unreadAdmin : Number(r[8]) || 0,
      unreadSiswa : Number(r[9]) || 0,
      createdAt   : r[10] || '',
      row         : i + 1,
    };
  }
  return null;
}

function chatNow_() {
  return new Date().toISOString();
}


// ================================================================
//  HELPER: AKSES SHEET
// ================================================================
function addToAkses(email, nama, kursusId, kursusNama, token) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, SH.AKSES, HEADERS.AKSES);

  // Cek apakah sudah ada (re-enroll)
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toLowerCase() === email.toLowerCase() && rows[i][2] === kursusId) {
      sheet.getRange(i+1,5).setValue(token);
      sheet.getRange(i+1,6).setValue(getExpDate(kursusId));
      return;
    }
  }

  sheet.appendRow([email, nama, kursusId, kursusNama, token, getExpDate(kursusId), '[]', now()]);
}

function getExpDate(kursusId) {
  // Default: akses 3 bulan. Sesuaikan per kursus jika perlu.
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toLocaleDateString('id-ID');
}


// ================================================================
//  TEMPLATE EMAIL
// ================================================================
function emailKonfirmasiPendaftar(email, nama, kursus, id, totalBayar) {
  const subject = `[${BRAND_NAME}] Pendaftaran diterima — ${id}`;
  const body = `Halo ${nama},

Terima kasih telah mendaftar di ${BRAND_NAME}! 🎉

Detail pendaftaran:
• Nomor Pendaftaran : ${id}
• Kursus            : ${kursus}
• Total Bayar       : ${totalBayar}
• Status            : Menunggu Verifikasi

Tim kami akan memverifikasi pembayaranmu dalam 1×24 jam kerja.
Setelah diverifikasi, kamu akan mendapat email berisi token akses untuk masuk ke portal belajar.

Ada pertanyaan? Balas email ini atau hubungi WhatsApp kami.

Salam,
Tim ${BRAND_NAME}`;
  try { GmailApp.sendEmail(email, subject, body); } catch(e){ Logger.log('Email error: '+e); }
}

function emailNotifAdmin(data, id) {
  const subject = `🔔 Pendaftar Baru: ${data.nama} — ${data.kursusNama||data.kursus}`;
  const body = `Ada pendaftar baru yang perlu diverifikasi!

No. Pendaftaran : ${id}
Nama            : ${data.nama}
Email           : ${data.email}
WhatsApp        : ${data.wa}
Kursus          : ${data.kursusNama || data.kursus}
Total Bayar     : ${data.totalBayar}
Sumber          : ${data.sumber || '-'}
Waktu           : ${data.timestamp}

Buka admin.html untuk memverifikasi pembayaran.`;
  try { GmailApp.sendEmail(ADMIN_EMAIL, subject, body); } catch(e){ Logger.log('Email error: '+e); }
}

function emailAksesSiswa(email, nama, kursus, token) {
  const subject = `🎓 [${BRAND_NAME}] Akses Kursus ${kursus} Aktif!`;
  const body = `Halo ${nama},

Pembayaranmu sudah diverifikasi! Selamat bergabung di ${BRAND_NAME} 🎉

Gunakan kredensial berikut untuk masuk ke portal belajar:

  Email  : ${email}
  Token  : ${token}
  Portal : ${PORTAL_URL}

⚠️  Jaga kerahasiaan token ini — jangan bagikan ke siapapun.

Fitur yang tersedia di portal:
• Video materi HD
• File PDF per modul
• Konten teks
• Kuis interaktif per modul (perlu skor ≥70% untuk lanjut)
• Tracking progress otomatis

Selamat belajar! 🚀

Salam,
Tim ${BRAND_NAME}`;
  try { GmailApp.sendEmail(email, subject, body); } catch(e){ Logger.log('Email error: '+e); }
}

function emailDitolak(email, nama, kursus) {
  const subject = `[${BRAND_NAME}] Update Pendaftaran ${kursus}`;
  const body = `Halo ${nama},

Kami sudah meninjau bukti pembayaranmu, namun ada kendala yang perlu diselesaikan.

Kemungkinan penyebab:
• Nominal transfer tidak sesuai (termasuk kode unik 3 digit)
• Bukti transfer tidak terbaca dengan jelas
• Transfer ke rekening yang salah

Silakan hubungi kami:
• Balas email ini
• WhatsApp: (nomor admin)

Kami siap membantu menyelesaikan masalah ini.

Salam,
Tim ${BRAND_NAME}`;
  try { GmailApp.sendEmail(email, subject, body); } catch(e){ Logger.log('Email error: '+e); }
}


// ================================================================
//  UTILS
// ================================================================
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let t = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) t += '-';
    t += chars[Math.floor(Math.random() * chars.length)];
  }
  return t; // format: XXXX-XXXX-XXXX
}

function now() {
  return new Date().toLocaleString('id-ID', { timeZone:'Asia/Jakarta' });
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    formatHeader(sheet);
  }
  return sheet;
}

function formatHeader(sheet) {
  if (sheet.getLastRow() < 1) return;
  const hRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  hRange.setFontWeight('bold')
        .setBackground('#1a6b4a')
        .setFontColor('#ffffff')
        .setFontFamily('Arial');
}


// ================================================================
//  SETUP AWAL — jalankan sekali via Run → setupSpreadsheet
// ================================================================
function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Buat semua sheet
  Object.keys(SH).forEach(key => {
    getOrCreateSheet(ss, SH[key], HEADERS[key]);
  });

  // Isi data contoh Kursus
  const kSheet = ss.getSheetByName(SH.KURSUS);
  if (kSheet.getLastRow() <= 1) {
    const kursusContoh = [
      ['C001','🎨','thumb-t1','Design','UI/UX Design Bootcamp','Kuasai Figma, design system, prototyping dari nol.','10 modul','3 bulan',299000,499000],
      ['C002','📣','thumb-t2','Marketing','Digital Marketing Pro','SEO, Meta Ads, Google Ads, dan strategi konten.','8 modul','3 bulan',249000,399000],
      ['C003','📊','thumb-t3','Data','Data Analytics dengan Python','Analisis data, visualisasi, dan machine learning.','12 modul','6 bulan',399000,699000],
      ['C004','💻','thumb-t4','Programming','Web Dev Full Stack','HTML, CSS, JS, React, dan Node.js lengkap.','15 modul','6 bulan',499000,799000],
    ];
    kursusContoh.forEach(r => kSheet.appendRow(r));
  }

  // Isi data contoh Materi (modul 1 & 2 untuk C001)
  const mSheet = ss.getSheetByName(SH.MATERI);
  if (mSheet.getLastRow() <= 1) {
    const quiz1 = JSON.stringify([
      {q:'Apa kepanjangan UX?',opts:['User Xperience','User Experience','Ultra Experience','Unique Experience'],ans:1,exp:'UX = User Experience.'},
      {q:'Elemen apa yang termasuk UI?',opts:['Alur navigasi','Loading speed','Warna tombol','Kepuasan user'],ans:2,exp:'UI mencakup elemen visual.'},
    ]);
    const quiz2 = JSON.stringify([
      {q:'Berapa tahap Design Thinking?',opts:['3','4','5','6'],ans:2,exp:'Ada 5 tahap.'},
      {q:'Tahap pertama adalah?',opts:['Define','Prototype','Ideate','Empathize'],ans:3,exp:'Empathize adalah tahap pertama.'},
    ]);
    mSheet.appendRow(['C001',1,'Pengantar UI/UX Design','Dasar-Dasar',24,'https://www.youtube.com/embed/dQw4w9WgXcQ','','Teks modul 1...','FALSE',quiz1]);
    mSheet.appendRow(['C001',2,'Design Thinking','Dasar-Dasar',31,'','','Teks modul 2...','FALSE',quiz2]);
    mSheet.appendRow(['C001',3,'User Research','Riset',42,'','','','FALSE','[]']);
  }

  SpreadsheetApp.flush();
  Logger.log('✅ Setup selesai! 4 sheet dibuat: Pendaftar, Kursus, Materi, Akses');
  Browser.msgBox('Setup berhasil! 4 sheet sudah siap. Sekarang deploy sebagai Web App.');
}


// ================================================================
//  TRIGGER HARIAN — kirim reminder jika ada pendaftar > 24 jam
//  Aktifkan di: Triggers → tambah → dailyReminder → Time-driven → Day timer
// ================================================================
function dailyReminder() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SH.PENDAFTAR);
  if (!sheet) return;

  const rows    = sheet.getDataRange().getValues();
  const pending = [];
  const cutoff  = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 jam lalu

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][13] !== 'pending') continue;
    const tgl = new Date(rows[i][1]);
    if (tgl < cutoff) pending.push({ id:rows[i][0], nama:rows[i][2], kursus:rows[i][7] });
  }

  if (pending.length === 0) return;

  const body = `Ada ${pending.length} pendaftar yang belum diverifikasi lebih dari 24 jam:\n\n` +
    pending.map(p => `• ${p.id} — ${p.nama} (${p.kursus})`).join('\n') +
    '\n\nBuka admin.html untuk memverifikasi.';

  GmailApp.sendEmail(ADMIN_EMAIL, `[${BRAND_NAME}] ${pending.length} pendaftar belum diverifikasi`, body);
}
