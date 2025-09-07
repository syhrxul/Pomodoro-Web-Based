/* ====== Elements ====== */
const timerDisplay = document.getElementById("timerDisplay");
const phaseText    = document.getElementById("phaseText");
const startBtn     = document.getElementById("startBtn");
const pauseBtn     = document.getElementById("pauseBtn");
const resetBtn     = document.getElementById("resetBtn");
const workInput    = document.getElementById("workInput");
const breakInput   = document.getElementById("breakInput");
const lapsInput    = document.getElementById("lapsInput");
const applyBtn     = document.getElementById("applyBtn");
const lapsDoneEl   = document.getElementById("lapsDone");
const lapsTotalEl  = document.getElementById("lapsTotal");
const barFill      = document.getElementById("barFill");
const startStampEl = document.getElementById("startStamp");
const endStampEl   = document.getElementById("endStamp");
const totalDurEl   = document.getElementById("totalDuration");
const messageEl    = document.getElementById("message");
const historyList  = document.getElementById("historyList");

/* ====== State ====== */
let workSec   = 25 * 60;
let breakSec  = 5 * 60;
let totalLaps = 4;

let isRunning = false;
let isWork    = true;
let timeLeft  = workSec;
let lapsDone  = 0;

let startTime = null;  // Date instance when pressing Start
let endTime   = null;  // Date instance when all laps done
let tick      = null;  // setInterval id

/* ====== LocalStorage Keys ====== */
const LS_PREFS    = "pomodoro_prefs_v1";
const LS_SESSIONS = "pomodoro_sessions_v1";
const LS_START    = "pomodoro_last_start_v1"; // ISO string when Start pressed

/* ====== Utils ====== */
const pad = (n) => String(n).padStart(2, "0");
function formatMMSS(s){
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${pad(m)}:${pad(sec)}`;
}
function formatDateTime(d){
  // dd/mm/yyyy HH:MM:SS
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth()+1);
  const yyyy = d.getFullYear();
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}
function humanDuration(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}j`);
  if (m) parts.push(`${m}m`);
  if (sec || parts.length===0) parts.push(`${sec}d`);
  return parts.join(" ");
}

/* ====== Load Preferences ====== */
(function initFromStorage(){
  try{
    const prefs = JSON.parse(localStorage.getItem(LS_PREFS) || "{}");
    if (prefs.workMin)   workInput.value = prefs.workMin;
    if (prefs.breakMin)  breakInput.value = prefs.breakMin;
    if (prefs.totalLaps) lapsInput.value = prefs.totalLaps;

    // apply to runtime
    applySettings();

    // load sessions
    renderHistory();

    // if there is a saved start
    const savedStartISO = localStorage.getItem(LS_START);
    if (savedStartISO){
      startTime = new Date(savedStartISO);
      startStampEl.textContent = formatDateTime(startTime);
    }
  }catch(e){ /* ignore */ }
})();

/* ====== Render ====== */
function renderTimer(){
  timerDisplay.textContent = formatMMSS(timeLeft);
}
function renderPhase(){
  phaseText.textContent = isWork ? "📚 Fokus Belajar" : "😌 Waktu Istirahat";
}
function renderLaps(){
  lapsDoneEl.textContent = String(lapsDone);
  lapsTotalEl.textContent = String(totalLaps);
  const pct = Math.min(100, Math.round((lapsDone/totalLaps)*100));
  barFill.style.width = `${pct}%`;
}
function renderHistory(){
  const sessions = JSON.parse(localStorage.getItem(LS_SESSIONS) || "[]");
  historyList.innerHTML = "";
  sessions.slice().reverse().forEach(s=>{
    const li = document.createElement("li");
    li.textContent = `📅 ${s.start} → ✅ ${s.end} • ⏱ ${s.duration} • 🔁 ${s.laps} lap`;
    historyList.appendChild(li);
  });
}
function clearMessage(){
  messageEl.classList.add("hidden");
  messageEl.textContent = "";
}

/* ====== Core Flow ====== */
function start(){
  if (isRunning) return;

  // capture start only once (include seconds)
  if (!startTime){
    startTime = new Date();
    localStorage.setItem(LS_START, startTime.toISOString());
    startStampEl.textContent = formatDateTime(startTime);
  }

  isRunning = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  timerDisplay.classList.remove("bounce");
  clearMessage();

  tick = setInterval(()=>{
    if (timeLeft > 0){
      timeLeft--;
      renderTimer();
      return;
    }

    // phase switch
    if (isWork){
      // switch to break
      isWork = false;
      timeLeft = breakSec;
      renderPhase();
      renderTimer();
    }else{
      // finished break => lap++
      lapsDone++;
      renderLaps();

      if (lapsDone >= totalLaps){
        // FINISH SESSION
        finishSession();
        return;
      }

      // back to work
      isWork = true;
      timeLeft = workSec;
      renderPhase();
      renderTimer();
    }
  }, 1000);
}

function pause(){
  if (!isRunning) return;
  isRunning = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  clearInterval(tick);
  // keep timer stopped (no bounce while paused)
}

function reset(){
  pause();
  // restore from inputs
  workSec   = Math.max(1, parseInt(workInput.value || "25", 10)) * 60;
  breakSec  = Math.max(1, parseInt(breakInput.value || "5", 10)) * 60;
  totalLaps = Math.max(1, parseInt(lapsInput.value || "4", 10));

  isWork   = true;
  timeLeft = workSec;
  lapsDone = 0;

  startTime = null;
  endTime   = null;
  localStorage.removeItem(LS_START);

  timerDisplay.classList.add("bounce");
  startBtn.disabled = false;
  pauseBtn.disabled = true;

  startStampEl.textContent = "—";
  endStampEl.textContent   = "—";
  totalDurEl.textContent   = "—";
  clearMessage();

  renderTimer();
  renderPhase();
  renderLaps();
}

function finishSession(){
  pause(); // clears interval and toggles buttons
  endTime = new Date();
  endStampEl.textContent = formatDateTime(endTime);

  // duration total from first Start to now
  const duration = humanDuration(endTime - startTime);
  totalDurEl.textContent = duration;

  // Store session into history
  const sessions = JSON.parse(localStorage.getItem(LS_SESSIONS) || "[]");
  sessions.push({
    start: formatDateTime(startTime),
    end: formatDateTime(endTime),
    duration,
    laps: totalLaps
  });
  localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions));

  // Clear saved start
  localStorage.removeItem(LS_START);

  // Motivational message
  messageEl.textContent = "🎉 Selamat! Kamu menuntaskan semua putaran. Terus konsisten, kamu keren! 💪";
  messageEl.classList.remove("hidden");
}

/* ====== Settings ====== */
function applySettings(){
  const w = Math.max(1, parseInt(workInput.value || "25", 10));
  const b = Math.max(1, parseInt(breakInput.value || "5", 10));
  const l = Math.max(1, parseInt(lapsInput.value || "4", 10));

  workInput.value  = w;
  breakInput.value = b;
  lapsInput.value  = l;

  // Save prefs
  localStorage.setItem(LS_PREFS, JSON.stringify({
    workMin: w, breakMin: b, totalLaps: l
  }));

  // Only apply immediately if not running
  if (!isRunning){
    workSec   = w * 60;
    breakSec  = b * 60;
    totalLaps = l;
    isWork    = true;
    timeLeft  = workSec;
    lapsDone  = 0;

    renderTimer();
    renderPhase();
    renderLaps();
  }
}

/* ====== Bindings ====== */
startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", pause);
resetBtn.addEventListener("click", reset);
applyBtn.addEventListener("click", applySettings);

/* ====== First Paint ====== */
renderTimer();
renderPhase();
renderLaps();
timerDisplay.classList.add("bounce");
pauseBtn.disabled = true;
clearMessage();
