import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ================= CONFIG =================
const firebaseConfig = {
  apiKey: "your api key",
  authDomain: "quiz-e1b86.firebaseapp.com",
  projectId: "quiz-e1b86",
  storageBucket: "quiz-e1b86.firebasestorage.app",
  messagingSenderId: "861958872710",
  appId: "1:861958872710:web:9d8ee80731318597057b07",
  measurementId: "G-2XM8959J6B"
};

const OPENROUTER_API_KEY = ".env";
const REVEAL_DELAY_MS = 5000;

// ================= INIT =================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ================= DOM =================
const body = document.body;

const themeToggle = document.getElementById("themeToggle");


const authBox = document.getElementById("authBox");
const lobby = document.getElementById("lobby");
const profileBox = document.getElementById("profile");

const quizSection = document.getElementById("quizSection");
const resultSection = document.getElementById("resultSection");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authMsg = document.getElementById("authMsg");
const lobbyStatus = document.getElementById("lobbyStatus");

const profilePic = document.getElementById("profilePic");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");

const subjectSelect = document.getElementById("subject");
const customSubjectInput = document.getElementById("customSubject");
const countInput = document.getElementById("count");
const durationInput = document.getElementById("duration");

const createRoomBtn = document.getElementById("createRoom");
const startQuizBtn = document.getElementById("startQuiz");
const pauseQuizBtn = document.getElementById("pauseQuiz");
const nextQuestionBtn = document.getElementById("nextQuestion");
const endQuizBtn = document.getElementById("endQuiz");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomStatusText = document.getElementById("roomStatusText");
const participantCount = document.getElementById("participantCount");
const hostRoomPanel = document.getElementById("hostRoomPanel");

const joinCodeInput = document.getElementById("joinCode");
const joinRoomBtn = document.getElementById("joinRoom");
const joinMsg = document.getElementById("joinMsg");
const participantListWrap = document.getElementById("participantListWrap");
const participantList = document.getElementById("participantList");

const roomBadge = document.getElementById("roomBadge");
const questionNumber = document.getElementById("questionNumber");
const questionText = document.getElementById("questionText");
const optionsWrap = document.getElementById("optionsWrap");
const timerFill = document.getElementById("timerFill");
const timerText = document.getElementById("timerText");
const feedbackText = document.getElementById("feedbackText");
const leaderboard = document.getElementById("leaderboard");

const finalScore = document.getElementById("finalScore");
const finalRank = document.getElementById("finalRank");
const finalAccuracy = document.getElementById("finalAccuracy");
const finalCW = document.getElementById("finalCW");
const backToLobbyBtn = document.getElementById("backToLobby");

// ================= STATE =================
let currentUser = null;
let currentRoomId = "";
let currentRoomData = null;
let isHost = false;
let currentQuestionIndex = 0;
let localTimerInterval = null;
let localAlreadyAnswered = false;
let participantsCache = [];

// ================= HELPERS =================
function randomRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getOptionLabel(index) {
  return ["A", "B", "C", "D"][index] || `${index + 1}`;
}

function normalizeQuestion(q) {
  if (!q || !q.question || !Array.isArray(q.options) || q.options.length < 2) {
    return null;
  }

  const cleanedOptions = q.options.map((opt) =>
    String(opt)
      .replace(/^[A-Da-d][\.\)\:\-\s]+/, "")
      .trim()
  );

  let answerIndex = -1;
  const rawAnswer = q.answer;

  if (typeof rawAnswer === "number") {
    answerIndex = rawAnswer;
  } else if (typeof rawAnswer === "string") {
    const ans = rawAnswer.trim();

    if (/^[0-3]$/.test(ans)) {
      answerIndex = Number(ans);
    } else if (/^[A-Da-d]$/.test(ans)) {
      answerIndex = ans.toUpperCase().charCodeAt(0) - 65;
    } else {
      answerIndex = cleanedOptions.findIndex(
        (opt) => opt.toLowerCase() === ans.toLowerCase()
      );

      if (answerIndex === -1) {
        const cleanedAnswer = ans.replace(/^[A-Da-d][\.\)\:\-\s]+/, "").trim();
        answerIndex = cleanedOptions.findIndex(
          (opt) => opt.toLowerCase() === cleanedAnswer.toLowerCase()
        );
      }
    }
  }

  if (answerIndex < 0 || answerIndex >= cleanedOptions.length) {
    answerIndex = 0;
  }

  const pairs = cleanedOptions.map((opt, idx) => ({
    option: opt,
    isCorrect: idx === answerIndex
  }));

  const shuffledPairs = shuffleArray(pairs);

  return {
    type: q.type || (cleanedOptions.length === 2 ? "true_false" : "mcq"),
    question: String(q.question).trim(),
    options: shuffledPairs.map((p) => p.option),
    answer: shuffledPairs.findIndex((p) => p.isCorrect)
  };
}

function getSelectedSubject() {
  return subjectSelect.value === "Other"
    ? customSubjectInput.value.trim()
    : subjectSelect.value.trim();
}

function setStatus(msg) {
  if (lobbyStatus) {
    lobbyStatus.textContent = msg || "";
  } else {
    console.log(msg || "");
  }
}

function setAuthStatus(msg) {
  authMsg.textContent = msg || "";
}

function setJoinMsg(msg) {
  joinMsg.textContent = msg || "";
}

function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
}

function safeName(user) {
  return user?.displayName || user?.email || "User";
}

function clearQuizTimer() {
  if (localTimerInterval) {
    clearInterval(localTimerInterval);
    localTimerInterval = null;
  }
}

function resetQuizUI() {
  questionNumber.textContent = "Question 1";
  roomBadge.textContent = "Room: -";
  questionText.textContent = "Question will appear here";
  optionsWrap.innerHTML = "";
  feedbackText.textContent = "";
  timerFill.style.width = "100%";
  timerText.textContent = "15s";
  clearQuizTimer();
}

function sortParticipants(list) {
  return [...list].sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return (a.lastAnsweredAt || 0) - (b.lastAnsweredAt || 0);
  });
}

function updateRoleLabel() {
  profileRole.textContent = isHost ? "Host" : "Player";
}

function renderParticipants(list) {
  if (!list.length) {
    participantList.innerHTML = `<div class="participant-item"><span>No participants yet</span></div>`;
    return;
  }

  participantList.innerHTML = list
    .map(
      (p) => `
      <div class="participant-item">
        <span>${p.name || "Player"}</span>
        <span>${p.score || 0} pts</span>
      </div>
    `
    )
    .join("");
}

function renderLeaderboard(list) {
  if (!list.length) {
    leaderboard.innerHTML = `<div class="rank-item"><div class="rank-badge">-</div><div><div class="rank-name">No scores yet</div></div><div class="rank-score">0</div></div>`;
    return;
  }

  const sorted = sortParticipants(list);

  leaderboard.innerHTML = sorted
    .map(
      (p, index) => `
      <div class="rank-item rank-${index + 1}">
        <div class="rank-badge">#${index + 1}</div>
        <div>
          <div class="rank-name">${p.name || "Player"}</div>
          <div class="rank-sub">${p.correctCount || 0} correct • ${p.wrongCount || 0} wrong</div>
        </div>
        <div class="rank-score">${p.score || 0}</div>
      </div>
    `
    )
    .join("");
}

function updateHostControls(room) {
  isHost = !!currentUser && room?.hostUid === currentUser.uid;
  updateRoleLabel();

  roomStatusText.textContent = room?.status || "waiting";
  roomCodeDisplay.textContent = currentRoomId || "-";
  roomBadge.textContent = `Room: ${currentRoomId || "-"}`;

  if (!currentRoomId) {
    hide(hostRoomPanel);
    hide(startQuizBtn);
    hide(pauseQuizBtn);
    hide(nextQuestionBtn);
    hide(endQuizBtn);
    return;
  }

  show(hostRoomPanel);

  if (!isHost) {
    hide(startQuizBtn);
    hide(pauseQuizBtn);
    hide(nextQuestionBtn);
    hide(endQuizBtn);
    return;
  }

  if (room.status === "waiting") {
    show(startQuizBtn);
    hide(pauseQuizBtn);
    hide(nextQuestionBtn);
    show(endQuizBtn);
  } else if (room.status === "live") {
    hide(startQuizBtn);
    show(pauseQuizBtn);
    show(nextQuestionBtn);
    show(endQuizBtn);
  } else if (room.status === "paused") {
    show(startQuizBtn);
    hide(pauseQuizBtn);
    show(nextQuestionBtn);
    show(endQuizBtn);
  } else {
    hide(startQuizBtn);
    hide(pauseQuizBtn);
    hide(nextQuestionBtn);
    show(endQuizBtn);
  }
}

function computeTimerRemaining(room) {
  const startedAt = room.questionStartedAt || 0;
  const durationMs = room.questionDurationMs || 15000;
  const elapsed = Date.now() - startedAt;
  return Math.max(0, durationMs - elapsed);
}

function lockOptions() {
  optionsWrap.querySelectorAll(".option-btn").forEach((btn) => {
    btn.classList.add("locked");
    btn.disabled = true;
  });
}

function highlightAnsweredOptions(correctIndex, selectedIndex) {
  const buttons = optionsWrap.querySelectorAll(".option-btn");

  buttons.forEach((btn, idx) => {
    btn.classList.add("locked");
    btn.disabled = true;
    btn.style.border = "1px solid rgba(255,255,255,0.12)";
    btn.style.background = "rgba(255,255,255,0.07)";

    if (idx === correctIndex) {
      btn.style.border = "2px solid #22c55e";
      btn.style.background = "rgba(34,197,94,0.18)";
    }

    if (idx === selectedIndex && selectedIndex !== correctIndex) {
      btn.style.border = "2px solid #ef4444";
      btn.style.background = "rgba(239,68,68,0.18)";
    }
  });
}

async function autoAdvanceIfNeeded() {
  if (!currentRoomData) return;

  const lastIndex = currentRoomData.questions.length - 1;

  if (currentRoomData.currentQuestionIndex >= lastIndex) {
    await updateDoc(doc(db, "rooms", currentRoomId), {
      status: "ended",
      endedAt: Date.now()
    });
  } else {
    await updateDoc(doc(db, "rooms", currentRoomId), {
      currentQuestionIndex: currentRoomData.currentQuestionIndex + 1,
      questionStartedAt: Date.now()
    });
  }
}

function startRevealCountdown() {
  clearQuizTimer();

  let countdown = Math.floor(REVEAL_DELAY_MS / 1000);
  timerText.textContent = `Next in ${countdown}s`;
  timerFill.style.width = "100%";

  localTimerInterval = setInterval(async () => {
    countdown--;
    timerText.textContent = `Next in ${countdown}s`;
    timerFill.style.width = `${(countdown / (REVEAL_DELAY_MS / 1000)) * 100}%`;

    if (countdown <= 0) {
      clearQuizTimer();
      if (isHost && currentRoomData?.status === "live") {
        await autoAdvanceIfNeeded();
      }
    }
  }, 1000);
}

function startQuestionTimer(room) {
  clearQuizTimer();

  const durationMs = room.questionDurationMs || 15000;

  const tick = () => {
    const remaining = computeTimerRemaining(room);
    const pct = Math.max(0, (remaining / durationMs) * 100);

    timerFill.style.width = `${pct}%`;
    timerText.textContent = `${Math.ceil(remaining / 1000)}s`;

    if (remaining <= 0) {
      clearQuizTimer();
      lockOptions();

      const q = room.questions?.[room.currentQuestionIndex];
      if (q) {
        feedbackText.textContent = `⏰ Time up! Correct answer: ${getOptionLabel(q.answer)}) ${q.options[q.answer]}`;
        highlightAnsweredOptions(q.answer, -1);
      }

      if (!localAlreadyAnswered) {
        startRevealCountdown();
      }
    }
  };

  tick();
  localTimerInterval = setInterval(tick, 250);
}

function renderQuestion(room) {
  const idx = room.currentQuestionIndex || 0;
  const q = room.questions?.[idx];

  if (!q) {
    questionText.textContent = "No question available";
    optionsWrap.innerHTML = "";
    return;
  }

  currentQuestionIndex = idx;
  localAlreadyAnswered = false;

  questionNumber.textContent = `Question ${idx + 1} / ${room.questions.length}`;
  questionText.textContent = q.question;
  feedbackText.textContent = "";

  optionsWrap.innerHTML = q.options
    .map((opt, i) => {
      const cleanOpt = String(opt)
        .replace(/^[A-Da-d][\.\)\:\-\s]+/, "")
        .trim();

      return `
        <button class="option-btn" data-index="${i}">
          <strong>${getOptionLabel(i)})</strong> ${cleanOpt}
        </button>
      `;
    })
    .join("");

  optionsWrap.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (localAlreadyAnswered) return;

      optionsWrap.querySelectorAll(".option-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      submitAnswer(Number(btn.dataset.index));
    });
  });

  startQuestionTimer(room);
}

function showWaitingState(msg = "Waiting for host to start the quiz") {
  show(quizSection);
  hide(resultSection);

  questionNumber.textContent = "Waiting";
  questionText.textContent = msg;
  optionsWrap.innerHTML = "";
  feedbackText.textContent = "";
  timerFill.style.width = "100%";
  timerText.textContent = "--";
  clearQuizTimer();
}

async function showFinalResult() {
  hide(quizSection);
  show(resultSection);
  clearQuizTimer();

  const my = participantsCache.find((p) => p.uid === currentUser?.uid) || {};
  const sorted = sortParticipants(participantsCache);
  const rank = sorted.findIndex((p) => p.uid === currentUser?.uid) + 1;
  const totalAttempted = (my.correctCount || 0) + (my.wrongCount || 0);
  const accuracy = totalAttempted
    ? Math.round(((my.correctCount || 0) / totalAttempted) * 100)
    : 0;

  finalScore.textContent = `${my.score || 0}`;
  finalRank.textContent = rank > 0 ? `#${rank}` : "#-";
  finalAccuracy.textContent = `${accuracy}%`;
  finalCW.textContent = `${my.correctCount || 0} / ${my.wrongCount || 0}`;
}

async function generateQuestions(subject, totalCount) {
  const count = Number(totalCount);

  const fallbackBank = {
    Python: [
      { type: "mcq", question: "Which keyword is used to define a function in Python?", options: ["func", "define", "def", "function"], answer: 2 },
      { type: "mcq", question: "Which of these is immutable in Python?", options: ["list", "set", "dictionary", "tuple"], answer: 3 },
      { type: "mcq", question: "What is the output of 2 * 3 ** 3?", options: ["54", "162", "216", "486"], answer: 0 },
      { type: "mcq", question: "What is the output type of input() in Python?", options: ["int", "string", "float", "bool"], answer: 1 }
    ],
    Java: [
      { type: "mcq", question: "Which keyword is used for inheritance in Java?", options: ["inherit", "implements", "extends", "super"], answer: 2 },
      { type: "mcq", question: "Which method is the entry point in Java?", options: ["run()", "start()", "main()", "init()"], answer: 2 }
    ],
    DBMS: [
      { type: "mcq", question: "Which SQL command is used to retrieve data?", options: ["GET", "FETCH", "SELECT", "SHOW"], answer: 2 }
    ],
    "Data Structures": [
      { type: "mcq", question: "Which data structure follows FIFO?", options: ["Stack", "Queue", "Tree", "Heap"], answer: 1 }
    ],
    default: [
      { type: "mcq", question: "Binary search works on which type of array?", options: ["Random array", "Sorted array", "Linked list", "Stack"], answer: 1 },
      { type: "mcq", question: "Which protocol is used to load web pages?", options: ["FTP", "SMTP", "HTTP", "SSH"], answer: 2 },
      { type: "mcq", question: "Which scheduling algorithm can cause starvation?", options: ["Round Robin", "FCFS", "Priority Scheduling", "FIFO"], answer: 2 }
    ]
  };

  try {
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "YOUR_OPENROUTER_KEY") {
      throw new Error("No OpenRouter key");
    }

    const prompt = `
Generate ${count} multiple choice questions STRICTLY about ${subject} for computer science engineering students.

Rules:
- Only ${subject}
- No general knowledge
- Exactly 4 options
- answer must be index number only
- return JSON array only

Format:
[
  {
    "type": "mcq",
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "answer": 0
  }
]
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Return only valid JSON array. No markdown. No explanation." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "OpenRouter request failed");
    }

    let text = data?.choices?.[0]?.message?.content || "";
    text = text.replace(/```json|```/gi, "").trim();

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) {
      throw new Error("AI did not return valid JSON array");
    }

    const parsed = JSON.parse(text.slice(start, end + 1));
    const valid = parsed.map(normalizeQuestion).filter(Boolean);

    if (!valid.length) {
      throw new Error("AI returned invalid questions");
    }

    return shuffleArray(valid).slice(0, count);
  } catch (err) {
    console.error("AI failed. Using fallback questions.", err);

    const bank = fallbackBank[subject] || fallbackBank.default;
    const repeated = [];

    while (repeated.length < count) {
      for (const q of bank) {
        if (repeated.length < count) {
          const normalized = normalizeQuestion(q);
          if (normalized) repeated.push(normalized);
        }
      }
    }

    return shuffleArray(repeated).slice(0, count);
  }
}

async function createParticipantDoc(roomId) {
  const playerRef = doc(db, "rooms", roomId, "participants", currentUser.uid);
  const existing = await getDoc(playerRef);

  if (existing.exists()) return;

  await setDoc(playerRef, {
    uid: currentUser.uid,
    name: safeName(currentUser),
    avatar: currentUser.photoURL || "",
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    answeredForIndex: -1,
    joinedAt: Date.now(),
    lastAnsweredAt: 0
  });
}

async function createRoom() {
  try {
    const subject = getSelectedSubject();
    const count = Number(countInput.value);
    const durationSec = Number(durationInput.value);

    if (!currentUser) {
      setStatus("Please login first.");
      return;
    }

    if (!subject) {
      setStatus("Please choose a subject.");
      return;
    }

    if (!count || count < 1 || count > 100) {
      setStatus("Question count must be between 1 and 100.");
      return;
    }

    if (!durationSec || durationSec < 5 || durationSec > 60) {
      setStatus("Timer must be between 5 and 60 seconds.");
      return;
    }

    createRoomBtn.disabled = true;
    setStatus("Creating room...");

    const roomCode = randomRoomCode();
    const questions = await generateQuestions(subject, count);

    if (!questions.length) {
      throw new Error("No questions generated.");
    }

    await setDoc(doc(db, "rooms", roomCode), {
      roomCode,
      hostUid: currentUser.uid,
      hostName: safeName(currentUser),
      subject,
      questionCount: count,
      questionDurationMs: durationSec * 1000,
      status: "waiting",
      currentQuestionIndex: 0,
      questionStartedAt: 0,
      locked: false,
      questions,
      createdAt: Date.now()
    });

    await createParticipantDoc(roomCode);

    currentRoomId = roomCode;
    roomCodeDisplay.textContent = roomCode;

    const canvas = document.getElementById("qrCanvas");
    if (canvas && typeof QRCode !== "undefined") {
      QRCode.toCanvas(canvas, `${window.location.origin}${window.location.pathname}?room=${roomCode}`, function (error) {
        if (error) console.error(error);
      });
    }

    setStatus(`Room created successfully: ${roomCode}`);
    createRoomBtn.disabled = false;

    listenToRoom(roomCode);
  } catch (err) {
    console.error("Create room failed:", err);
    setStatus(`Create room failed: ${err.message}`);
    createRoomBtn.disabled = false;
  }
}

async function joinRoom() {
  try {
    const roomCode = joinCodeInput.value.trim().toUpperCase();

    if (!currentUser) {
      setJoinMsg("Please login first.");
      return;
    }

    if (!roomCode) {
      setJoinMsg("Enter room code.");
      return;
    }

    const roomRef = doc(db, "rooms", roomCode);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      setJoinMsg("Room not found.");
      return;
    }

    const room = roomSnap.data();

    if (room.locked) {
      setJoinMsg("Room is locked.");
      return;
    }

    await createParticipantDoc(roomCode);

    currentRoomId = roomCode;
    setJoinMsg(`Joined room: ${roomCode}`);
    listenToRoom(roomCode);
  } catch (err) {
    console.error("Join room failed:", err);
    setJoinMsg(`Join failed: ${err.message}`);
  }
}

function listenToParticipants(roomId) {
  const participantsRef = query(
    collection(db, "rooms", roomId, "participants"),
    orderBy("score", "desc")
  );

  onSnapshot(participantsRef, (snap) => {
    const list = [];
    snap.forEach((d) => list.push(d.data()));
    participantsCache = list;

    participantCount.textContent = String(list.length);
    renderParticipants(list);
    renderLeaderboard(list);
  });
}

function listenToRoom(roomId) {
  show(lobby);
  show(participantListWrap);

  listenToParticipants(roomId);

  onSnapshot(doc(db, "rooms", roomId), (snap) => {
    if (!snap.exists()) return;

    const room = snap.data();
    currentRoomData = room;
    currentRoomId = roomId;

    updateHostControls(room);

    if (room.status === "waiting") {
      showWaitingState("Room created. Waiting for host to start.");
      hide(resultSection);
    } else if (room.status === "paused") {
      showWaitingState("Quiz paused by host.");
      hide(resultSection);
    } else if (room.status === "live") {
      show(quizSection);
      hide(resultSection);
      renderQuestion(room);
    } else if (room.status === "ended") {
      showFinalResult();
    }
  });
}

async function startQuiz() {
  if (!currentRoomId || !currentRoomData || !isHost) return;

  await updateDoc(doc(db, "rooms", currentRoomId), {
    status: "live",
    locked: true,
    currentQuestionIndex: 0,
    questionStartedAt: Date.now()
  });
}

async function pauseQuiz() {
  if (!currentRoomId || !isHost) return;

  await updateDoc(doc(db, "rooms", currentRoomId), {
    status: "paused"
  });
}

async function nextQuestion() {
  if (!currentRoomId || !isHost || !currentRoomData) return;
  await autoAdvanceIfNeeded();
}

async function endQuiz() {
  if (!currentRoomId || !isHost) return;

  await updateDoc(doc(db, "rooms", currentRoomId), {
    status: "ended"
  });
}

async function submitAnswer(selectedIndex) {
  if (!currentUser || !currentRoomData || localAlreadyAnswered) return;

  const remaining = computeTimerRemaining(currentRoomData);
  if (remaining <= 0) return;

  const playerRef = doc(db, "rooms", currentRoomId, "participants", currentUser.uid);
  const playerSnap = await getDoc(playerRef);

  if (!playerSnap.exists()) {
    await createParticipantDoc(currentRoomId);
  }

  const playerData = (await getDoc(playerRef)).data() || {
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    answeredForIndex: -1,
    lastAnsweredAt: 0
  };

  if (playerData.answeredForIndex === currentQuestionIndex) {
    console.log("Blocked: Already answered");
    return;
  }

  if (remaining <= 0) {
    console.log("Blocked: Time over");
    return;
  }

  localAlreadyAnswered = true;
  clearQuizTimer();

  const question = currentRoomData.questions[currentQuestionIndex];
  const correctIndex = Number(question.answer);

  const isCorrect = selectedIndex === correctIndex;
  const speedBonus = isCorrect ? Math.floor(remaining / 100) : 0;
  const gained = isCorrect ? 100 + speedBonus : 0;

  const correctSound = document.getElementById("correctSound");
  const wrongSound = document.getElementById("wrongSound");

  if (isCorrect) {
    if (correctSound) correctSound.play().catch(() => {});
    if (typeof confetti === "function") {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
  } else {
    if (wrongSound) wrongSound.play().catch(() => {});
  }

  await setDoc(
    playerRef,
    {
      ...playerData,
      score: (playerData.score || 0) + gained,
      correctCount: (playerData.correctCount || 0) + (isCorrect ? 1 : 0),
      wrongCount: (playerData.wrongCount || 0) + (isCorrect ? 0 : 1),
      answeredForIndex: currentQuestionIndex,
      lastAnsweredAt: Date.now()
    },
    { merge: true }
  );

  highlightAnsweredOptions(correctIndex, selectedIndex);

  feedbackText.textContent = isCorrect
    ? `✅ Correct! +${gained} points`
    : `❌ Wrong. Correct answer: ${getOptionLabel(correctIndex)}) ${question.options[correctIndex]}`;

  startRevealCountdown();
}

// ================= EVENTS =================
themeToggle.addEventListener("click", () => {
  body.classList.toggle("light");
  const isLight = body.classList.contains("light");
  localStorage.setItem("quiz-theme", isLight ? "light" : "dark");
  themeToggle.textContent = isLight ? "☀️" : "🌙";
});

subjectSelect.addEventListener("change", () => {
  if (subjectSelect.value === "Other") {
    show(customSubjectInput);
  } else {
    hide(customSubjectInput);
    customSubjectInput.value = "";
  }
});

document.getElementById("signup").addEventListener("click", async () => {
  try {
    const res = await createUserWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value.trim()
    );
    await updateProfile(res.user, { displayName: nameInput.value.trim() || "User" });
    setAuthStatus("Signup successful.");
  } catch (err) {
    console.error(err);
    setAuthStatus(err.message);
  }
});

document.getElementById("login").addEventListener("click", async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value.trim()
    );
    setAuthStatus("Login successful.");
  } catch (err) {
    console.error(err);
    setAuthStatus(err.message);
  }
});

document.getElementById("googleLogin").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    setAuthStatus("Google login successful.");
  } catch (err) {
    console.error(err);
    setAuthStatus(err.message);
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  await signOut(auth);
  currentRoomId = "";
  currentRoomData = null;
  isHost = false;
  participantsCache = [];
  hide(lobby);
  hide(profileBox);
  hide(quizSection);
  hide(resultSection);
  show(authBox);
  resetQuizUI();
});

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", joinRoom);
startQuizBtn.addEventListener("click", startQuiz);
pauseQuizBtn.addEventListener("click", pauseQuiz);
nextQuestionBtn.addEventListener("click", nextQuestion);
endQuizBtn.addEventListener("click", endQuiz);

backToLobbyBtn.addEventListener("click", () => {
  hide(resultSection);
  show(lobby);
});

// ================= AUTH STATE =================
onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    hide(authBox);
    show(lobby);
    show(profileBox);

    profilePic.src =
      user.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName(user))}`;

    profileName.textContent = safeName(user);
    updateRoleLabel();
  } else {
    show(authBox);
    hide(lobby);
    hide(profileBox);
    hide(quizSection);
    hide(resultSection);
  }
});

// ================= INIT =================
(function init() {
  const theme = localStorage.getItem("quiz-theme") || "dark";
  if (theme === "light") body.classList.add("light");
  themeToggle.textContent = body.classList.contains("light") ? "☀️" : "🌙";
})();