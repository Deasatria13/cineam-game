import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Landmark, Search, Skull, Timer as TimerIcon, Users, Lock,
  X, Copy, LogIn, PlusCircle, Play, RefreshCw,
  Fingerprint, ChevronRight, Crown, Wifi, WifiOff,
  Drama, ScrollText, CloudRain, Clock3, MapPin, Sparkles, Wheat
} from "lucide-react";
import { db } from "./firebase";
import { ref, get as fbGet, set as fbSet } from "firebase/database";

/* ============================================================
   CONTENT — original Cineam data (rural crime drama, Kec. Cineam
   Tasikmalaya, Jawa Barat — desa dipakai sebagai latar fiktif)
   ============================================================ */
const EVIDENCE_POOL = [
  { id: "E01", name: "Surat Tanah Warisan", icon: "📜" },
  { id: "E02", name: "Kwitansi Utang Piutang", icon: "🧾" },
  { id: "E03", name: "Buku Catatan Koperasi Desa", icon: "📒" },
  { id: "E04", name: "Kalung Emas Peninggalan", icon: "📿" },
  { id: "E05", name: "Foto Lama Berdua", icon: "📷" },
  { id: "E06", name: "Surat Cinta Robek", icon: "💌" },
  { id: "E07", name: "Kunci Gudang Padi", icon: "🔑" },
  { id: "E08", name: "Ponsel Terkubur di Sawah", icon: "📱" },
  { id: "E09", name: "Sarung Basah Berlumpur", icon: "🧣" },
  { id: "E10", name: "Caping Sobek", icon: "👒" },
];
const MEANS_POOL = [
  { id: "M01", name: "Golok", icon: "🔪" },
  { id: "M02", name: "Arit / Sabit", icon: "🌾" },
  { id: "M03", name: "Cangkul", icon: "⛏️" },
  { id: "M04", name: "Racun Tikus", icon: "🧪" },
  { id: "M05", name: "Tali Jemuran", icon: "🪢" },
  { id: "M06", name: "Batu Kali", icon: "🪨" },
  { id: "M07", name: "Pupuk Kimia", icon: "🧴" },
  { id: "M08", name: "Obeng Bengkel", icon: "🔧" },
  { id: "M09", name: "Selang Traktor", icon: "🚜" },
  { id: "M10", name: "Kayu Bakar", icon: "🪵" },
];

const SCENE_TILES = {
  CAUSE: {
    label: "Sebab Kematian", icon: Skull,
    options: ["Tercekik", "Diracun", "Dipukul Benda Tumpul", "Ditebas Golok", "Terjatuh dari Tebing", "Tenggelam di Sungai"],
  },
  LOCATION: {
    label: "Lokasi Kejadian", icon: MapPin,
    options: ["Kebun Cengkeh Ancol", "Balai Desa Cisarua", "Gudang Padi Cijulang", "Pasar Cineam", "Tepi Sungai Rajadatu", "Kebun Kopi Pasirmukti"],
  },
  CONDITION: {
    label: "Kondisi Korban", icon: Drama,
    options: ["Masih Menggenggam Cangkul", "Tangan Terikat Tali", "Wajah Tertutup Sarung", "Memegang Surat Tanah", "Duduk di Kursi Balai", "Tanpa Tanda Perlawanan"],
  },
  CLUE: {
    label: "Petunjuk", icon: Search,
    options: ["Jejak Sandal di Lumpur", "Lampu Petromaks Mati", "Bau Pupuk Menyengat", "Anjing Menggonggong Semalaman", "Surat Ancaman Ditemukan", "Jejak Ban Motor"],
  },
  DURATION: {
    label: "Durasi", icon: Clock3,
    options: ["Sebelum Subuh", "Saat Musim Panen", "Tengah Malam", "Dini Hari Sebelum Pasar Buka", "Saat Warga Ronda", "Setelah Pengajian Malam"],
  },
  WEATHER: {
    label: "Cuaca", icon: CloudRain,
    options: ["Hujan Deras", "Kabut Tebal", "Kemarau Panjang", "Angin Kencang", "Mendung Gelap", "Bulan Purnama Terang"],
  },
};
const TILE_ORDER = ["CAUSE", "LOCATION", "CONDITION", "CLUE", "DURATION", "WEATHER"];

const ROLE_INFO = {
  FORENSIK: { label: "Petugas Forensik", color: "var(--teal)", desc: "Didatangkan dari Kabupaten, kamu tahu solusi kasus. Susun papan petunjuk di balai desa untuk mengarahkan warga — tanpa bicara langsung." },
  PEMBUNUH: { label: "Pembunuh", color: "var(--red)", desc: "Identitasmu rahasia di antara warga kampung. Pilih Bukti Kunci & Sarana dari 'milikmu' sendiri sebagai solusi, lalu bertahan dari kecurigaan tetangga." },
  PENYELIDIK: { label: "Warga Penyelidik", color: "var(--violet)", desc: "Ikuti petunjuk Petugas Forensik, diskusikan dugaan bersama warga lain, dan kamu punya SATU kesempatan mengungkap kasusnya." },
};

const DISCUSSION_SECONDS = 100;

/* ============================================================
   HELPERS
   ============================================================ */
const rid = () => Math.random().toString(36).slice(2, 10);
const roomCodeGen = () => "CINEAM-" + Math.random().toString(36).slice(2, 6).toUpperCase();
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function dealHand() {
  return {
    evidence: shuffle(EVIDENCE_POOL).slice(0, 4).map((c) => c.id),
    means: shuffle(MEANS_POOL).slice(0, 4).map((c) => c.id),
  };
}
// Data room dipakai bersama semua pemain, jadi disimpan di Firebase
// Realtime Database di path rooms/{code}, bukan di penyimpanan lokal.
async function getRoom(code) {
  try {
    const snap = await fbGet(ref(db, `rooms/${code}`));
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.error("firebase get failed", e);
    return null;
  }
}
async function setRoom(code, data) {
  try {
    // JSON round-trip membuang key bernilai `undefined`, karena
    // Firebase RTDB menolak nilai undefined saat menulis data.
    const clean = JSON.parse(JSON.stringify(data));
    await fbSet(ref(db, `rooms/${code}`), clean);
  } catch (e) {
    console.error("firebase set failed", e);
  }
}

// Identitas & preferensi pemain (myId, myName, lastRoom) sifatnya
// per-perangkat saja, jadi cukup pakai localStorage biasa.
function localGet(key) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? null : v;
  } catch {
    return null;
  }
}
function localSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error("localStorage set failed", e);
  }
}
function localDelete(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error("localStorage delete failed", e);
  }
}
function pushLog(room, text) {
  room.log = [{ id: rid(), text, t: Date.now() }, ...(room.log || [])].slice(0, 40);
}

/* ============================================================
   ATOMS — Claymorphism + Neo-Brutalism primitives
   ============================================================ */
function ClayButton({ children, onClick, variant = "clay", full, disabled, icon: Icon, small, style }) {
  const base = {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: small ? 13 : 15,
    letterSpacing: 0.2,
    padding: small ? "9px 14px" : "14px 22px",
    borderRadius: 16,
    border: "3px solid var(--ink)",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: full ? "100%" : "auto",
    opacity: disabled ? 0.5 : 1,
    boxShadow: disabled ? "none" : "5px 5px 0 var(--ink)",
    transform: "translate(0,0)",
    transition: "transform .08s ease, box-shadow .08s ease",
    color: "var(--ink)",
  };
  const variants = {
    clay: { background: "var(--clay)" },
    gold: { background: "var(--gold)" },
    red: { background: "var(--red)", color: "var(--cream)" },
    teal: { background: "var(--teal)", color: "var(--cream)" },
    ghost: { background: "transparent", boxShadow: "none", border: "3px solid var(--cream-dim)", color: "var(--cream)" },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "translate(4px,4px)", e.currentTarget.style.boxShadow = "1px 1px 0 var(--ink)"; }}
      onMouseUp={(e) => { if (!disabled) e.currentTarget.style.transform = "translate(0,0)", e.currentTarget.style.boxShadow = "5px 5px 0 var(--ink)"; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.transform = "translate(0,0)", e.currentTarget.style.boxShadow = variants[variant].boxShadow ?? "5px 5px 0 var(--ink)"; }}
    >
      {Icon && <Icon size={small ? 15 : 18} strokeWidth={2.5} />}
      {children}
    </button>
  );
}

function ClayPanel({ children, style, pad = 22, tint = "var(--clay)" }) {
  return (
    <div
      style={{
        background: tint,
        border: "3px solid var(--ink)",
        borderRadius: 24,
        padding: pad,
        boxShadow: "8px 8px 0 var(--ink), inset -8px -8px 18px rgba(0,0,0,.10), inset 8px 8px 18px rgba(255,255,255,.55)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Tag({ children, color = "var(--violet)", style }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: color,
        color: "var(--cream)",
        border: "2.5px solid var(--ink)",
        borderRadius: 999,
        padding: "4px 12px",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Space Grotesk', sans-serif",
        boxShadow: "3px 3px 0 var(--ink)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Marquee({ children, size = 34 }) {
  return (
    <h1
      className="flicker"
      style={{
        fontFamily: "'Creepster', 'Archivo Black', sans-serif",
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1.08,
        color: "var(--cream)",
        textShadow: "0 0 18px rgba(227,67,43,.55), 4px 4px 0 var(--red)",
        margin: 0,
        letterSpacing: 1,
      }}
    >
      {children}
    </h1>
  );
}

function CountdownBar({ endsAt, totalSeconds }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const remain = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const pct = Math.max(0, Math.min(100, (remain / totalSeconds) * 100));
  const urgent = remain <= 15;
  return (
    <div style={{ width: "100%" }} className={urgent ? "heartbeat" : ""}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 12, color: "var(--ink)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TimerIcon size={14} /> {urgent ? "Waktu hampir habis…" : "Diskusi"}</span>
        <span>{remain}s</span>
      </div>
      <div style={{ height: 16, background: "var(--clay-dark)", border: "3px solid var(--ink)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: urgent ? "var(--red)" : "var(--teal)", transition: "width .5s linear" }} />
      </div>
    </div>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */
export default function App() {
  const [screen, setScreen] = useState("home"); // home | create | join | game
  const [dismissedReveal, setDismissedReveal] = useState(null);
  const [myId, setMyId] = useState(null);
  const [myName, setMyName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [maxPlayersInput, setMaxPlayersInput] = useState(6);
  const [roomCode, setRoomCode] = useState(null);
  const [room, setRoomState] = useState(null);
  const [error, setError] = useState("");
  const [copyOk, setCopyOk] = useState(false);
  const pollRef = useRef(null);

  // boot: restore identity + last room
  useEffect(() => {
    (async () => {
      try {
        let id = localGet("myId");
        let name = localGet("myName");
        let lastCode = localGet("lastRoom");
        if (!id) { id = rid(); localSet("myId", id); }
        setMyId(id);
        if (name) { setMyName(name); setNameInput(name); }
        if (lastCode) {
          const r = await getRoom(lastCode);
          if (r && r.players.some((p) => p.id === id)) {
            setRoomCode(lastCode);
            setRoomState(r);
            setScreen("game");
          }
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  // polling
  useEffect(() => {
    if (screen === "game" && roomCode) {
      pollRef.current = setInterval(async () => {
        const r = await getRoom(roomCode);
        if (r) setRoomState(r);
      }, 2200);
      return () => clearInterval(pollRef.current);
    }
  }, [screen, roomCode]);

  const isHost = room && myId === room.hostId;
  const me = room?.players?.find((p) => p.id === myId);
  const myRole = room?.playerRoles?.[myId];

  const refresh = useCallback(async () => {
    if (!roomCode) return;
    const r = await getRoom(roomCode);
    if (r) setRoomState(r);
  }, [roomCode]);

  const withRoom = async (mutator) => {
    const r = await getRoom(roomCode);
    if (!r) return;
    mutator(r);
    await setRoom(roomCode, r);
    setRoomState(r);
  };

  /* ---------- host-authority: auto-advance timer ---------- */
  useEffect(() => {
    if (!isHost || !room) return;
    if (room.status !== "PRESENTATION") return;
    if (!room.phaseEndsAt) return;
    const check = setInterval(async () => {
      if (Date.now() >= room.phaseEndsAt) {
        await withRoom((r) => {
          if (r.status !== "PRESENTATION" || Date.now() < r.phaseEndsAt) return;
          advanceRoundInPlace(r);
        });
      }
    }, 1500);
    return () => clearInterval(check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, room?.status, room?.phaseEndsAt, roomCode]);

  function advanceRoundInPlace(r) {
    if (r.round >= 3) {
      r.status = "GAME_END";
      r.winner = r.winner || "PEMBUNUH";
      pushLog(r, "Waktu habis. Pembunuh menang — kasus tidak terpecahkan.");
    } else {
      r.round += 1;
      r.status = "COLLECTION";
      r.phaseEndsAt = null;
      pushLog(r, `Ronde ${r.round} dimulai. Forensik memperbarui papan petunjuk.`);
    }
  }

  /* ---------- actions ---------- */
  async function saveName(n) {
    setMyName(n);
    localSet("myName", n);
  }

  async function createRoom() {
    if (!nameInput.trim()) return setError("Isi nama kamu dulu.");
    await saveName(nameInput.trim());
    const code = roomCodeGen();
    const newRoom = {
      code, hostId: myId, status: "LOBBY", mode: "BASIC",
      maxPlayers: Number(maxPlayersInput) || 6, createdAt: Date.now(),
      players: [{ id: myId, name: nameInput.trim(), connected: true }],
      log: [], round: 1,
    };
    pushLog(newRoom, `${nameInput.trim()} membuat room.`);
    await setRoom(code, newRoom);
    localSet("lastRoom", code);
    setRoomCode(code); setRoomState(newRoom); setScreen("game"); setError("");
  }

  async function joinRoom() {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return setError("Masukkan kode room.");
    if (!nameInput.trim()) return setError("Isi nama kamu dulu.");
    const r = await getRoom(code);
    if (!r) return setError("Room tidak ditemukan.");
    if (r.status !== "LOBBY" && !r.players.some((p) => p.id === myId)) return setError("Game sudah dimulai.");
    await saveName(nameInput.trim());
    if (!r.players.some((p) => p.id === myId)) {
      if (r.players.length >= r.maxPlayers) return setError("Room penuh.");
      r.players.push({ id: myId, name: nameInput.trim(), connected: true });
      pushLog(r, `${nameInput.trim()} bergabung.`);
    } else {
      r.players = r.players.map((p) => (p.id === myId ? { ...p, connected: true } : p));
    }
    await setRoom(code, r);
    localSet("lastRoom", code);
    setRoomCode(code); setRoomState(r); setScreen("game"); setError("");
  }

  async function leaveRoom() {
    if (roomCode) {
      await withRoom((r) => {
        r.players = r.players.filter((p) => p.id !== myId);
        pushLog(r, `${myName} meninggalkan room.`);
      }).catch(() => {});
    }
    localDelete("lastRoom");
    setRoomCode(null); setRoomState(null); setScreen("home");
  }

  async function startGame() {
    await withRoom((r) => {
      if (r.players.length < 4) return;
      const shuffled = shuffle(r.players.map((p) => p.id));
      const forensikId = shuffled[0];
      const pembunuhId = shuffled[1];
      const roles = {};
      const hands = {};
      r.players.forEach((p) => {
        if (p.id === forensikId) roles[p.id] = "FORENSIK";
        else if (p.id === pembunuhId) { roles[p.id] = "PEMBUNUH"; hands[p.id] = dealHand(); }
        else { roles[p.id] = "PENYELIDIK"; hands[p.id] = dealHand(); }
      });
      r.playerRoles = roles;
      r.playerHands = hands;
      r.forensikId = forensikId;
      r.pembunuhId = pembunuhId;
      r.status = "CRIME_SETUP";
      r.solution = null;
      r.round = 1;
      r.startedAt = Date.now();
      r.tiles = TILE_ORDER.reduce((acc, k) => { acc[k] = null; return acc; }, {});
      r.solveAttempts = {};
      r.winner = null;
      r.log = [];
      pushLog(r, "Game dimulai. Role & kartu telah dibagikan secara privat.");
    });
  }

  async function submitSolution(evidenceId, meansId) {
    await withRoom((r) => {
      r.solution = { evidenceId, meansId };
      r.status = "COLLECTION";
      pushLog(r, "Pembunuh telah menetapkan solusi kasus (rahasia).");
    });
  }

  async function placeTile(tileKey, optionIndex) {
    await withRoom((r) => {
      r.tiles[tileKey] = optionIndex;
      pushLog(r, `Forensik memperbarui petunjuk: ${SCENE_TILES[tileKey].label}.`);
    });
  }

  async function beginPresentation() {
    await withRoom((r) => {
      r.status = "PRESENTATION";
      r.phaseEndsAt = Date.now() + DISCUSSION_SECONDS * 1000;
      const order = r.players.filter((p) => p.id !== r.forensikId).map((p) => p.id);
      r.presentationOrder = order;
      r.presenterIdx = 0;
      pushLog(r, `Presentasi Ronde ${r.round} dimulai.`);
    });
  }

  async function nextPresenter() {
    await withRoom((r) => {
      r.presenterIdx = Math.min((r.presenterIdx || 0) + 1, (r.presentationOrder || []).length - 1);
    });
  }

  async function forceAdvanceRound() {
    await withRoom((r) => advanceRoundInPlace(r));
  }

  async function attemptSolve(evidenceId, meansId) {
    let result = false;
    await withRoom((r) => {
      const correct = r.solution && r.solution.evidenceId === evidenceId && r.solution.meansId === meansId;
      result = correct;
      r.solveAttempts[myId] = { evidenceId, meansId, correct, t: Date.now() };
      pushLog(r, `${myName} mencoba memecahkan kasus — ${correct ? "BENAR!" : "salah."}`);
      if (correct) {
        r.status = "GAME_END";
        r.winner = "PENYELIDIK";
      }
    });
    return result;
  }

  async function rematch() {
    await withRoom((r) => {
      r.status = "LOBBY";
      r.playerRoles = null; r.playerHands = null; r.solution = null;
      r.round = 1; r.tiles = null; r.solveAttempts = {}; r.winner = null;
      pushLog(r, "Room direset untuk permainan baru.");
    });
  }

  function copyCode() {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopyOk(true); setTimeout(() => setCopyOk(false), 1400);
    });
  }

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div style={{ minHeight: 560, background: "var(--bg)", position: "relative", overflow: "hidden", fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Creepster&family=Space+Grotesk:wght@400;500;700&display=swap');
        :root{
          --bg:#0A090D; --ink:#15121C; --cream:#F5ECDA; --cream-dim:#9C93A6;
          --clay:#F1E6D2; --clay-dark:#D8C7A1; --clay-mute:#EADFC9;
          --red:#E3432B; --gold:#F2B705; --teal:#1F9E89; --violet:#7B5EA7;
        }
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        .spotlight {
          position:absolute; top:-220px; left:50%; transform:translateX(-50%);
          width:900px; height:900px; border-radius:50%;
          background: radial-gradient(circle, rgba(242,183,5,0.10) 0%, rgba(242,183,5,0) 65%);
          pointer-events:none;
        }
        .filmgrain { position:absolute; inset:0; opacity:.06; pointer-events:none; z-index:3;
          background-image: repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px); }
        .vignette { position:absolute; inset:0; pointer-events:none; z-index:3;
          box-shadow: inset 0 0 160px 60px rgba(0,0,0,.85); }
        .scanlines { position:absolute; inset:0; pointer-events:none; z-index:3; opacity:.10;
          background-image: repeating-linear-gradient(180deg, rgba(255,255,255,.5) 0 1px, transparent 1px 4px);
          animation: scanDrift 9s linear infinite; }
        @keyframes scanDrift { from{ background-position-y:0; } to{ background-position-y:400px; } }
        .fog { position:absolute; pointer-events:none; z-index:2; border-radius:50%;
          filter: blur(40px); mix-blend-mode: screen; }
        .fog1 { width:640px; height:340px; left:-140px; bottom:-80px; background:rgba(155,150,180,.10);
          animation: fogDrift1 26s ease-in-out infinite alternate; }
        .fog2 { width:560px; height:300px; right:-160px; top:60px; background:rgba(120,60,60,.08);
          animation: fogDrift2 32s ease-in-out infinite alternate; }
        @keyframes fogDrift1 { from{ transform:translateX(0) translateY(0);} to{ transform:translateX(120px) translateY(-30px);} }
        @keyframes fogDrift2 { from{ transform:translateX(0) translateY(0);} to{ transform:translateX(-100px) translateY(40px);} }
        .flicker { animation: flicker 6s linear infinite; }
        @keyframes flicker {
          0%,19%,21%,23%,80%,100% { opacity:1; }
          20%,22%,79% { opacity:.72; }
          50% { opacity:.94; }
        }
        .shake { animation: shake .5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          10%,90% { transform: translate3d(-1px,0,0); }
          20%,80% { transform: translate3d(2px,0,0); }
          30%,50%,70% { transform: translate3d(-5px,0,0); }
          40%,60% { transform: translate3d(5px,0,0); }
        }
        .heartbeat { animation: heartbeat 1s ease-in-out infinite; }
        @keyframes heartbeat { 0%,100%{ transform:scale(1);} 50%{ transform:scale(1.03);} }
        @media (prefers-reduced-motion: reduce) {
          .flicker, .scanlines, .fog1, .fog2, .shake, .heartbeat { animation: none !important; }
        }
        .cardbadge { display:flex; align-items:center; gap:8px; background:var(--clay-mute); border:2.5px solid var(--ink); border-radius:12px; padding:8px 10px; font-size:13px; font-weight:600; }
        .scaleIn { animation: scaleIn .35s cubic-bezier(.2,1.4,.4,1); }
        @keyframes scaleIn { from{ opacity:0; transform: scale(.9) translateY(8px);} to {opacity:1; transform:scale(1) translateY(0);} }
        ::selection { background: var(--gold); color: var(--ink); }
      `}</style>
      <div className="spotlight" />
      <div className="fog fog1" />
      <div className="fog fog2" />
      <div className="filmgrain" />
      <div className="scanlines" />
      <div className="vignette" />

      <div style={{ position: "relative", zIndex: 1, padding: "28px 20px 60px", maxWidth: 920, margin: "0 auto" }}>
        {screen === "home" && (
          <HomeScreen
            nameInput={nameInput} setNameInput={setNameInput}
            onGoCreate={() => setScreen("create")}
            onGoJoin={() => setScreen("join")}
          />
        )}

        {screen === "create" && (
          <CenteredForm title="Buat Room" onBack={() => setScreen("home")}>
            <FieldLabel>Nama Kamu</FieldLabel>
            <TextInput value={nameInput} onChange={setNameInput} placeholder="mis. Dea" />
            <FieldLabel>Jumlah Pemain Maksimal</FieldLabel>
            <SelectInput value={maxPlayersInput} onChange={setMaxPlayersInput} options={[4,5,6,7,8,9,10,11,12]} />
            {error && <ErrorText>{error}</ErrorText>}
            <ClayButton full variant="red" icon={Landmark} onClick={createRoom} style={{ marginTop: 8 }}>Buat Room</ClayButton>
          </CenteredForm>
        )}

        {screen === "join" && (
          <CenteredForm title="Gabung Room" onBack={() => setScreen("home")}>
            <FieldLabel>Nama Kamu</FieldLabel>
            <TextInput value={nameInput} onChange={setNameInput} placeholder="mis. Budi" />
            <FieldLabel>Kode Room</FieldLabel>
            <TextInput value={joinCodeInput} onChange={(v) => setJoinCodeInput(v.toUpperCase())} placeholder="CINEAM-XXXX" mono />
            {error && <ErrorText>{error}</ErrorText>}
            <ClayButton full variant="teal" icon={LogIn} onClick={joinRoom} style={{ marginTop: 8 }}>Gabung</ClayButton>
          </CenteredForm>
        )}

        {screen === "game" && room && (
          <GameScreens
            room={room} myId={myId} myName={myName} isHost={isHost} me={me} myRole={myRole}
            copyCode={copyCode} copyOk={copyOk} onLeave={leaveRoom}
            onStart={startGame} onSubmitSolution={submitSolution}
            onPlaceTile={placeTile} onBeginPresentation={beginPresentation}
            onNextPresenter={nextPresenter} onForceAdvance={forceAdvanceRound}
            onAttemptSolve={attemptSolve} onRematch={rematch} onRefresh={refresh}
            dismissedReveal={dismissedReveal} setDismissedReveal={setDismissedReveal}
          />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   HOME
   ============================================================ */
function HomeScreen({ nameInput, setNameInput, onGoCreate, onGoJoin }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 24 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Landmark color="var(--gold)" size={26} />
        <Tag color="var(--violet)">SOCIAL DEDUCTION · PRIVATE ROOM</Tag>
      </div>
      <Marquee size={42}>DECEPTION:<br />MURDER IN CINEAM</Marquee>
      <p style={{ color: "var(--cream-dim)", maxWidth: 480, margin: "16px auto 6px", lineHeight: 1.6 }}>
        Satu kampung, satu pembunuh yang bersembunyi di antara warga. Ikuti papan
        petunjuk dari Petugas Forensik, adu argumen di balai desa, dan ungkap
        Bukti Kunci + Sarana sebelum jejaknya hilang ditelan waktu.
      </p>
      <p style={{ color: "var(--cream-dim)", maxWidth: 460, margin: "0 auto 30px", lineHeight: 1.6, fontSize: 13, fontStyle: "italic" }}>
        Kasus fiktif — berlatar sepuluh desa di Kecamatan Cineam, Kabupaten Tasikmalaya:
        dari kebun cengkeh Ancol sampai balai desa Cisarua.
      </p>
      <ClayPanel style={{ maxWidth: 380, margin: "0 auto" }}>
        <FieldLabel>Nama Kamu</FieldLabel>
        <TextInput value={nameInput} onChange={setNameInput} placeholder="Masukkan nama..." />
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <ClayButton full variant="red" icon={PlusCircle} onClick={onGoCreate}>Buat Room</ClayButton>
          <ClayButton full variant="teal" icon={LogIn} onClick={onGoJoin}>Gabung</ClayButton>
        </div>
      </ClayPanel>
      <p style={{ color: "var(--cream-dim)", fontSize: 12, marginTop: 22 }}>
        4–12 pemain · butuh diskusi suara langsung / voice call di luar aplikasi
      </p>
    </div>
  );
}

function CenteredForm({ title, children, onBack }) {
  return (
    <div style={{ maxWidth: 380, margin: "40px auto 0" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--cream-dim)", cursor: "pointer", marginBottom: 14, fontWeight: 700, fontFamily: "inherit" }}>
        ← Kembali
      </button>
      <ClayPanel>
        <h2 style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 22, margin: "0 0 16px", color: "var(--ink)" }}>{title}</h2>
        {children}
      </ClayPanel>
    </div>
  );
}
function FieldLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6, marginTop: 12, textTransform: "none" }}>{children}</div>;
}
function TextInput({ value, onChange, placeholder, mono }) {
  return (
    <input
      value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{
        width: "100%", padding: "12px 14px", borderRadius: 12, border: "3px solid var(--ink)",
        background: "var(--cream)", fontSize: 15, fontWeight: mono ? 700 : 500,
        fontFamily: mono ? "'Space Grotesk',monospace" : "inherit",
        boxShadow: "inset 3px 3px 8px rgba(0,0,0,.12)", outline: "none",
      }}
    />
  );
}
function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "3px solid var(--ink)", background: "var(--cream)", fontSize: 15, fontWeight: 700, outline: "none" }}
    >
      {options.map((o) => <option key={o} value={o}>{o} pemain</option>)}
    </select>
  );
}
function ErrorText({ children }) {
  return <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 13, marginTop: 10 }}>{children}</div>;
}

/* ============================================================
   GAME ROUTER
   ============================================================ */
function GameScreens(props) {
  const { room, myRole, dismissedReveal, setDismissedReveal } = props;
  const showReveal = !!(room.startedAt && myRole && room.status !== "LOBBY" && dismissedReveal !== room.startedAt);
  return (
    <div>
      <TopBar {...props} />
      {showReveal && (
        <RoleRevealOverlay role={myRole} onContinue={() => setDismissedReveal(room.startedAt)} />
      )}
      {room.status === "LOBBY" && <LobbyScreen {...props} />}
      {room.status === "CRIME_SETUP" && <CrimeSetupScreen {...props} />}
      {(room.status === "COLLECTION" || room.status === "PRESENTATION") && <InvestigationScreen {...props} />}
      {room.status === "GAME_END" && <ResultScreen {...props} />}
    </div>
  );
}

function RoleRevealOverlay({ role, onContinue }) {
  const [peeked, setPeeked] = useState(false);
  const info = ROLE_INFO[role];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,3,6,.94)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="scaleIn" style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        {!peeked ? (
          <>
            <Fingerprint size={40} color="var(--cream-dim)" className="flicker" style={{ marginBottom: 14 }} />
            <p className="flicker" style={{ color: "var(--cream-dim)", fontFamily: "'Creepster',sans-serif", fontSize: 24, letterSpacing: 1, marginBottom: 22 }}>
              seseorang di kampung ini menyimpan rahasia...
            </p>
            <ClayButton variant="red" onClick={() => setPeeked(true)}>Lihat Peranmu</ClayButton>
          </>
        ) : (
          <ClayPanel tint={info.color} style={{ color: "var(--cream)" }}>
            <div style={{ fontFamily: "'Creepster',sans-serif", fontSize: 30, marginBottom: 6, letterSpacing: 1 }}>{info.label}</div>
            <p style={{ opacity: 0.95, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>{info.desc}</p>
            <ClayButton variant="gold" onClick={onContinue}>Mengerti, Lanjutkan</ClayButton>
          </ClayPanel>
        )}
      </div>
    </div>
  );
}

function TopBar({ room, copyCode, copyOk, onLeave, myRole }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Landmark color="var(--gold)" size={22} />
        <span style={{ fontFamily: "'Archivo Black',sans-serif", color: "var(--cream)", fontSize: 18 }}>CINEAM</span>
        <button onClick={copyCode} style={{ background: "var(--clay)", border: "2.5px solid var(--ink)", borderRadius: 10, padding: "5px 10px", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, cursor: "pointer", boxShadow: "3px 3px 0 var(--ink)" }}>
          {room.code} <Copy size={13} />
        </button>
        {copyOk && <span style={{ color: "var(--gold)", fontSize: 12, fontWeight: 700 }}>disalin!</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {myRole && <Tag color={ROLE_INFO[myRole].color}>{ROLE_INFO[myRole].label}</Tag>}
        <ClayButton small variant="ghost" onClick={onLeave}>Keluar</ClayButton>
      </div>
    </div>
  );
}

/* ============================================================
   LOBBY
   ============================================================ */
function LobbyScreen({ room, isHost, onStart }) {
  const canStart = room.players.length >= 4;
  return (
    <div className="scaleIn">
      <ClayPanel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Users size={18} /><h3 style={{ margin: 0, fontFamily: "'Archivo Black',sans-serif" }}>LOBBY ({room.players.length}/{room.maxPlayers})</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
          {room.players.map((p) => (
            <div key={p.id} className="cardbadge">
              {p.id === room.hostId ? <Crown size={15} color="var(--gold)" /> : <Fingerprint size={15} />}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              {p.connected ? <Wifi size={13} color="var(--teal)" /> : <WifiOff size={13} color="var(--red)" />}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20 }}>
          {isHost ? (
            <>
              <ClayButton variant="red" icon={Play} disabled={!canStart} onClick={onStart}>Mulai Game</ClayButton>
              {!canStart && <ErrorText>Minimal 4 pemain untuk mulai.</ErrorText>}
            </>
          ) : (
            <p style={{ color: "var(--ink)", opacity: 0.7, fontWeight: 600 }}>Menunggu host memulai permainan...</p>
          )}
        </div>
      </ClayPanel>
      <LogFeed room={room} />
    </div>
  );
}

function LogFeed({ room }) {
  if (!room.log?.length) return null;
  return (
    <div style={{ marginTop: 16, maxHeight: 130, overflowY: "auto", padding: "4px 2px" }}>
      {room.log.slice(0, 8).map((l) => (
        <div key={l.id} style={{ color: "var(--cream-dim)", fontSize: 12, marginBottom: 4 }}>• {l.text}</div>
      ))}
    </div>
  );
}

/* ============================================================
   CRIME SETUP
   ============================================================ */
function CrimeSetupScreen({ room, myId, myRole, onSubmitSolution }) {
  const [ev, setEv] = useState(null);
  const [me, setMe] = useState(null);
  const isPembunuh = myRole === "PEMBUNUH";
  const hand = room.playerHands?.[myId];
  const alreadySet = !!room.solution;

  if (isPembunuh && !alreadySet) {
    return (
      <div className="scaleIn">
        <ClayPanel tint="var(--red)" style={{ color: "var(--cream)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <Skull size={20} className="flicker" /><h3 style={{ margin: 0, fontFamily: "'Creepster',sans-serif", fontSize: 22, letterSpacing: 1 }}>PANEL RAHASIA PEMBUNUH</h3>
          </div>
          <p style={{ opacity: 0.9, fontSize: 14 }}>Pilih 1 Bukti dan 1 Sarana dari kartumu sendiri sebagai solusi kasus. Ini akan dirahasiakan dari semua Penyelidik.</p>
        </ClayPanel>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <CardPicker title="Bukti Kunci" ids={hand.evidence} pool={EVIDENCE_POOL} selected={ev} onSelect={setEv} />
          <CardPicker title="Sarana Pembunuhan" ids={hand.means} pool={MEANS_POOL} selected={me} onSelect={setMe} />
        </div>
        <ClayButton style={{ marginTop: 18 }} variant="red" disabled={!ev || !me} icon={Lock} onClick={() => onSubmitSolution(ev, me)}>
          Kunci Solusi
        </ClayButton>
      </div>
    );
  }

  return (
    <div className="scaleIn" style={{ textAlign: "center", padding: "40px 0" }}>
      <Skull size={38} color="var(--gold)" className="flicker" style={{ marginBottom: 10 }} />
      <h3 style={{ fontFamily: "'Archivo Black',sans-serif", color: "var(--cream)" }}>
        {alreadySet ? "Solusi telah dikunci. Menyiapkan papan petunjuk..." : "Pembunuh sedang menetapkan solusi kasus..."}
      </h3>
      <p style={{ color: "var(--cream-dim)" }}>Lihat kartu publik & role kamu di bawah sambil menunggu.</p>
      {hand && <MyHand hand={hand} />}
      {myRole === "FORENSIK" && <RoleCallout role={myRole} />}
    </div>
  );
}

function CardPicker({ title, ids, pool, selected, onSelect }) {
  return (
    <ClayPanel pad={14}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ids.map((id) => {
          const c = pool.find((x) => x.id === id);
          const sel = selected === id;
          return (
            <button key={id} onClick={() => onSelect(id)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10,
                border: "2.5px solid var(--ink)", cursor: "pointer", textAlign: "left",
                background: sel ? "var(--gold)" : "var(--cream)",
                boxShadow: sel ? "inset 2px 2px 6px rgba(0,0,0,.2)" : "2px 2px 0 var(--ink)",
                fontWeight: 600, fontSize: 13,
              }}>
              <span>{c.icon}</span>{c.name}
            </button>
          );
        })}
      </div>
    </ClayPanel>
  );
}

function MyHand({ hand }) {
  return (
    <div style={{ maxWidth: 480, margin: "22px auto 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <MiniHandList title="Kartu Bukti-mu" ids={hand.evidence} pool={EVIDENCE_POOL} />
      <MiniHandList title="Kartu Sarana-mu" ids={hand.means} pool={MEANS_POOL} />
    </div>
  );
}
function MiniHandList({ title, ids, pool }) {
  return (
    <ClayPanel pad={12}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {ids.map((id) => {
        const c = pool.find((x) => x.id === id);
        return <div key={id} className="cardbadge" style={{ marginBottom: 6 }}>{c.icon} {c.name}</div>;
      })}
    </ClayPanel>
  );
}
function RoleCallout({ role }) {
  const info = ROLE_INFO[role];
  return (
    <ClayPanel style={{ maxWidth: 420, margin: "18px auto 0", textAlign: "left" }} tint={info.color}>
      <div style={{ color: "var(--cream)", fontWeight: 700, marginBottom: 4 }}>{info.label}</div>
      <div style={{ color: "var(--cream)", opacity: 0.9, fontSize: 13 }}>{info.desc}</div>
    </ClayPanel>
  );
}

/* ============================================================
   INVESTIGATION (collection + presentation)
   ============================================================ */
function InvestigationScreen(props) {
  const { room, myId, myRole, isHost, onPlaceTile, onBeginPresentation, onNextPresenter, onForceAdvance, onAttemptSolve } = props;
  const [showSolve, setShowSolve] = useState(false);
  const [flash, setFlash] = useState(null); // 'correct' | 'wrong' | null
  const hand = room.playerHands?.[myId];
  const isForensik = myRole === "FORENSIK";
  const isInvestigator = myRole === "PENYELIDIK" || myRole === "PEMBUNUH";
  const alreadySolved = !!room.solveAttempts?.[myId];
  const presenting = room.status === "PRESENTATION";
  const currentPresenterId = presenting ? room.presentationOrder?.[room.presenterIdx] : null;
  const currentPresenterName = room.players.find((p) => p.id === currentPresenterId)?.name;
  const isLastPresenter = presenting && room.presenterIdx >= (room.presentationOrder?.length || 1) - 1;

  async function handleSolveSubmit(e, m) {
    setShowSolve(false);
    const correct = await onAttemptSolve(e, m);
    setFlash(correct ? "correct" : "wrong");
    setTimeout(() => setFlash(null), 1700);
  }

  return (
    <div className="scaleIn">
      {flash && <SolveFlash correct={flash === "correct"} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <Tag color="var(--gold)" style={{ color: "var(--ink)" }}>RONDE {room.round} / 3 · {presenting ? "PRESENTASI" : "PENGUMPULAN PETUNJUK"}</Tag>
        {isInvestigator && !alreadySolved && (
          <ClayButton small variant="red" icon={Search} onClick={() => setShowSolve(true)}>Pecahkan Kasus</ClayButton>
        )}
        {alreadySolved && !room.solveAttempts[myId].correct && <Tag color="var(--red)">Kesempatan solve-mu sudah dipakai</Tag>}
      </div>

      <ClayPanel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <ScrollText size={18} /><h3 style={{ margin: 0, fontFamily: "'Archivo Black',sans-serif" }}>PAPAN PETUNJUK FORENSIK</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 12 }}>
          {TILE_ORDER.map((key) => (
            <SceneTile key={key} tileKey={key} value={room.tiles?.[key]} editable={isForensik && !presenting} onPick={(idx) => onPlaceTile(key, idx)} />
          ))}
        </div>
      </ClayPanel>

      {presenting && (
        <ClayPanel style={{ marginTop: 16 }}>
          <CountdownBar endsAt={room.phaseEndsAt} totalSeconds={DISCUSSION_SECONDS} />
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>🎤 Giliran bicara: <span style={{ color: "var(--red)" }}>{currentPresenterName || "-"}</span></div>
            {isHost && (
              <div style={{ display: "flex", gap: 8 }}>
                {!isLastPresenter && <ClayButton small onClick={onNextPresenter}>Giliran Berikutnya</ClayButton>}
                <ClayButton small variant="teal" icon={ChevronRight} onClick={onForceAdvance}>{room.round >= 3 ? "Akhiri Investigasi" : "Lanjut Ronde"}</ClayButton>
              </div>
            )}
          </div>
        </ClayPanel>
      )}

      {!presenting && isForensik && (
        <ClayButton style={{ marginTop: 16 }} variant="gold" icon={Play} onClick={onBeginPresentation}>Mulai Sesi Presentasi</ClayButton>
      )}
      {!presenting && !isForensik && (
        <p style={{ color: "var(--cream-dim)", marginTop: 14, fontWeight: 600 }}>Menunggu Forensik menyusun papan petunjuk...</p>
      )}

      {hand && <MyHand hand={hand} />}
      <LogFeed room={room} />

      {showSolve && (
        <SolveModal onClose={() => setShowSolve(false)} onSubmit={handleSolveSubmit} />
      )}
    </div>
  );
}

function SolveFlash({ correct }) {
  return (
    <div
      className={correct ? "" : "shake"}
      style={{
        position: "fixed", inset: 0, zIndex: 90, pointerEvents: "none",
        background: correct
          ? "radial-gradient(circle, rgba(242,183,5,.22) 0%, rgba(242,183,5,0) 70%)"
          : "rgba(150,10,10,.28)",
        transition: "opacity .3s",
      }}
    />
  );
}

function SceneTile({ tileKey, value, editable, onPick }) {
  const def = SCENE_TILES[tileKey];
  const Icon = def.icon;
  return (
    <div style={{ background: "var(--clay-mute)", border: "2.5px solid var(--ink)", borderRadius: 14, padding: 10, boxShadow: "4px 4px 0 var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        <Icon size={14} /> {def.label}
      </div>
      {editable ? (
        <select value={value ?? ""} onChange={(e) => onPick(Number(e.target.value))}
          style={{ width: "100%", padding: 6, borderRadius: 8, border: "2px solid var(--ink)", fontSize: 12, fontWeight: 600 }}>
          <option value="" disabled>Pilih...</option>
          {def.options.map((o, i) => <option key={o} value={i}>{o}</option>)}
        </select>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 700, color: value != null ? "var(--ink)" : "var(--cream-dim)", minHeight: 18 }}>
          {value != null ? def.options[value] : "belum ditentukan"}
        </div>
      )}
    </div>
  );
}

function SolveModal({ onClose, onSubmit }) {
  const [ev, setEv] = useState(null);
  const [me, setMe] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div className="scaleIn" style={{ maxWidth: 460, width: "100%" }}>
        <ClayPanel tint="var(--cream)">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontFamily: "'Archivo Black',sans-serif" }}>MEMECAHKAN KASUS</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X /></button>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.75, marginBottom: 10 }}>Ini satu-satunya kesempatanmu. Pilih dengan yakin.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Bukti Kunci</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {EVIDENCE_POOL.map((c) => (
                  <MiniPick key={c.id} c={c} sel={ev === c.id} onClick={() => setEv(c.id)} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Sarana Pembunuhan</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {MEANS_POOL.map((c) => (
                  <MiniPick key={c.id} c={c} sel={me === c.id} onClick={() => setMe(c.id)} />
                ))}
              </div>
            </div>
          </div>
          <ClayButton full style={{ marginTop: 16 }} variant="red" disabled={!ev || !me} onClick={() => onSubmit(ev, me)}>
            Konfirmasi Jawaban
          </ClayButton>
        </ClayPanel>
      </div>
    </div>
  );
}
function MiniPick({ c, sel, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 8,
      border: "2px solid var(--ink)", cursor: "pointer", textAlign: "left", fontSize: 12, fontWeight: 600,
      background: sel ? "var(--gold)" : "var(--clay-mute)",
    }}>
      <span>{c.icon}</span>{c.name}
    </button>
  );
}

/* ============================================================
   RESULT
   ============================================================ */
function ResultScreen({ room, isHost, onRematch }) {
  const win = room.winner === "PENYELIDIK";
  const ev = EVIDENCE_POOL.find((c) => c.id === room.solution?.evidenceId);
  const me = MEANS_POOL.find((c) => c.id === room.solution?.meansId);
  return (
    <div className="scaleIn">
      <ClayPanel tint={win ? "var(--teal)" : "var(--red)"} style={{ textAlign: "center", color: "var(--cream)" }}>
        <Sparkles size={30} style={{ marginBottom: 6 }} />
        <h2 className="flicker" style={{ fontFamily: "'Creepster',sans-serif", fontSize: 30, margin: "0 0 4px", letterSpacing: 1 }}>
          {win ? "TIM PENYELIDIK MENANG" : "PEMBUNUH MENANG"}
        </h2>
        <p style={{ opacity: 0.9 }}>
          {win ? "Kasus terpecahkan. Warga Cineam akhirnya bisa tidur nyenyak malam ini." : "Kasus tidak terpecahkan — sang pembunuh menghilang ke dalam kabut."}
        </p>
      </ClayPanel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
        <ClayPanel>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Solusi Kasus</div>
          <div className="cardbadge" style={{ marginBottom: 8 }}>{ev?.icon} {ev?.name}</div>
          <div className="cardbadge">{me?.icon} {me?.name}</div>
        </ClayPanel>
        <ClayPanel>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Role Semua Pemain</div>
          {room.players.map((p) => (
            <div key={p.id} className="cardbadge" style={{ marginBottom: 6, justifyContent: "space-between" }}>
              <span>{p.name}</span>
              <Tag color={ROLE_INFO[room.playerRoles?.[p.id]]?.color}>{ROLE_INFO[room.playerRoles?.[p.id]]?.label}</Tag>
            </div>
          ))}
        </ClayPanel>
      </div>

      {isHost && <ClayButton style={{ marginTop: 18 }} variant="gold" icon={RefreshCw} onClick={onRematch}>Main Lagi</ClayButton>}
      <LogFeed room={room} />
    </div>
  );
}
