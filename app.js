"use strict";

const $ = (id) => document.getElementById(id);
const SESSION_SIZE = 10;
const state = { levels: [], selectedLevel: null, questions: [], index: 0, selected: null, checked: false, streak: 0 };
const keywordSet = new Set(["const", "let", "var", "function", "return", "if", "else", "for", "of", "in", "true", "false", "null", "undefined", "new", "break", "continue"]);

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

function validateLevels(levels) {
  const levelIds = new Set(); const questionIds = new Set(); const errors = [];
  if (!Array.isArray(levels)) errors.push("LEVELS は配列である必要があります。");
  (levels || []).forEach((level, levelIndex) => {
    const name = `levels[${levelIndex}]`;
    ["id", "label", "description", "questions"].forEach((field) => { if (!(field in level)) errors.push(`${name}: ${field} がありません。`); });
    if (levelIds.has(level.id)) errors.push(`${name}: レベルID「${level.id}」が重複しています。`); levelIds.add(level.id);
    if (!Array.isArray(level.questions)) { errors.push(`${name}: questions は配列である必要があります。`); return; }
    level.questions.forEach((question, questionIndex) => {
      const qName = `${name}.questions[${questionIndex}]`;
      ["id", "category", "prompt", "before", "after", "choices", "answer", "explanation"].forEach((field) => { if (!(field in question)) errors.push(`${qName}: ${field} がありません。`); });
      if (questionIds.has(question.id)) errors.push(`${qName}: 問題ID「${question.id}」が重複しています。`); questionIds.add(question.id);
      if (!Array.isArray(question.choices) || question.choices.length !== 4) errors.push(`${qName}: choices は重複なしの4要素である必要があります。`);
      else { if (new Set(question.choices).size !== 4) errors.push(`${qName}: choices に重複があります。`); if (!question.choices.includes(question.answer)) errors.push(`${qName}: answer が choices に含まれていません。`); }
    });
  });
  errors.forEach((error) => console.error(`[問題データエラー] ${error}`));
  return errors.length === 0;
}

function renderLevels() {
  $("levelList").replaceChildren(...state.levels.map((level) => {
    const available = level.questions.length >= SESSION_SIZE; const card = document.createElement("article");
    card.className = `level-card${available ? "" : " level-card--locked"}`;
    const title = document.createElement("h3"); title.textContent = level.label;
    const description = document.createElement("p"); description.textContent = level.description;
    const count = document.createElement("span"); count.className = "level-card__count"; count.textContent = available ? `${level.questions.length}問を収録` : `準備中（${level.questions.length}問）`;
    const button = document.createElement("button"); button.type = "button"; button.className = "level-card__button"; button.textContent = available ? "このレベルを始める →" : "準備中"; button.disabled = !available;
    button.addEventListener("click", () => startSession(level.id)); card.append(title, description, count, button); return card;
  }));
}

function startSession(levelId) {
  const level = state.levels.find((item) => item.id === levelId); if (!level || level.questions.length < SESSION_SIZE) return;
  state.selectedLevel = level.id; state.questions = shuffle(level.questions).slice(0, SESSION_SIZE);
  state.index = 0; state.selected = null; state.checked = false; state.streak = 0;
  $("streak").textContent = "0"; $("streakBox").hidden = false; $("levelView").hidden = true; $("resultView").hidden = true; $("quizView").hidden = false; $("energy").hidden = false;
  $("sessionLevel").textContent = level.label; createNotches(); updateEnergy(0); renderQuestion();
}

function showLevels() {
  state.selectedLevel = null; state.questions = []; $("energy").hidden = true; $("streakBox").hidden = true; $("quizView").hidden = true; $("resultView").hidden = true; $("levelView").hidden = false;
  $("effectLayer").replaceChildren(); $("effectLayer").className = ""; $("energyTrack").classList.remove("energy__track--hit"); renderLevels();
}

function createNotches() {
  $("energyNotches").replaceChildren(...Array.from({ length: SESSION_SIZE }, (_, index) => { const notch = document.createElement("span"); notch.className = "energy__notch"; notch.style.left = `${(index + 1) * 10}%`; return notch; }));
}

function renderQuestion() {
  const question = state.questions[state.index];
  $("questionNumber").textContent = `QUESTION ${String(state.index + 1).padStart(2, "0")} / ${SESSION_SIZE}`; $("category").textContent = question.category; $("prompt").textContent = question.prompt;
  renderCode(`${question.before}____${question.after}`); $("feedback").replaceChildren(); $("feedback").hidden = true; $("feedback").className = "feedback";
  state.selected = null; state.checked = false; $("choices").replaceChildren(...shuffle(question.choices).map(makeChoice)); $("actionButton").textContent = "回答する"; $("actionButton").disabled = true;
}

function makeChoice(choice, index) {
  const button = document.createElement("button"); button.type = "button"; button.className = "choice"; button.dataset.value = choice; button.setAttribute("aria-pressed", "false");
  const key = document.createElement("span"); key.className = "choice__key"; key.textContent = String.fromCharCode(65 + index);
  const code = document.createElement("code"); code.textContent = choice;
  const status = document.createElement("span"); status.className = "choice__status"; status.setAttribute("aria-hidden", "true");
  button.append(key, code, status); button.addEventListener("click", () => selectChoice(button, choice)); return button;
}

function selectChoice(button, value) {
  if (state.checked) return;
  document.querySelectorAll(".choice").forEach((item) => { item.classList.remove("choice--selected"); item.setAttribute("aria-pressed", "false"); item.querySelector(".choice__status").textContent = ""; });
  button.classList.add("choice--selected"); button.setAttribute("aria-pressed", "true"); button.querySelector(".choice__status").textContent = "選択中"; state.selected = value; $("actionButton").disabled = false;
}

function handleAction() {
  if (state.checked) { nextQuestion(); return; } if (state.selected === null) return;
  const question = state.questions[state.index]; state.checked = true; const correct = state.selected === question.answer;
  document.querySelectorAll(".choice").forEach((button) => {
    button.disabled = true;
    if (button.dataset.value === question.answer) { button.classList.add("choice--correct"); button.setAttribute("aria-label", `${button.dataset.value}、正解`); button.querySelector(".choice__status").textContent = "✓ 正解"; }
    else if (button.dataset.value === state.selected) { button.classList.add("choice--wrong"); button.setAttribute("aria-label", `${button.dataset.value}、不正解`); button.querySelector(".choice__status").textContent = "✕ 不正解"; }
  });
  renderCode(`${question.before}${state.selected}${question.after}`); renderFeedback(correct, question);
  if (correct) { state.streak += 1; $("streak").textContent = state.streak; playCorrectEffect(); } else { state.streak = 0; $("streak").textContent = "0"; }
  updateEnergy(state.index + 1); $("actionButton").textContent = state.index === SESSION_SIZE - 1 ? "結果を見る →" : "次の問題へ →";
}

function renderFeedback(correct, question) {
  const feedback = $("feedback"); feedback.hidden = false; feedback.classList.add(correct ? "feedback--correct" : "feedback--wrong");
  const heading = document.createElement("strong"); heading.textContent = correct ? "✓ 正解です" : `✕ 正解は ${question.answer} です`;
  const text = document.createElement("p"); text.textContent = question.explanation; feedback.append(heading, text);
}

function nextQuestion() { state.index += 1; if (state.index >= SESSION_SIZE) { showResult(); return; } renderQuestion(); }

function showResult() {
  const level = state.levels.find((item) => item.id === state.selectedLevel);
  $("energy").hidden = true; $("streakBox").hidden = true; $("quizView").hidden = true; $("resultView").hidden = false; $("resultLevel").textContent = level ? level.label : ""; $("restartButton").focus();
}

function updateEnergy(completed) {
  const percent = completed * 10; $("energyFill").style.width = `${percent}%`; $("energyHead").style.left = `${percent}%`; $("energyText").textContent = `SYNC ${percent}%`;
  document.querySelectorAll(".energy__notch").forEach((item, index) => item.classList.toggle("energy__notch--on", index < completed));
}

function renderCode(source) {
  const root = $("code"); root.replaceChildren();
  const tokens = source.match(/(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/\/[^\n]*|____|\s+|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|.)/g) || [];
  tokens.forEach((token, index) => {
    const span = document.createElement("span"); span.textContent = token; let kind = "plain";
    if (token === "____") kind = "blank"; else if (/^['"`]/.test(token)) kind = "string"; else if (/^\d/.test(token)) kind = "number"; else if (keywordSet.has(token)) kind = "keyword";
    else if (/^[A-Za-z_$]/.test(token)) { const previous = tokens.slice(0, index).reverse().find((item) => !/^\s+$/.test(item)); const next = tokens.slice(index + 1).find((item) => !/^\s+$/.test(item)); kind = previous === "." ? "property" : next === "(" ? "function" : "identifier"; }
    else if (/[=><!+\-*/]/.test(token)) kind = "operator"; else if (/[{}[\]();,.]/.test(token)) kind = "punctuation"; span.className = `syntax-${kind}`; root.append(span);
  });
}

function randomBetween(min, max) { return min + Math.random() * (max - min); }
function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }

function playConfettiShow(source) {
  if (typeof window.confetti !== "function") return;
  const center = { x: (source.left + source.width / 2) / window.innerWidth, y: (source.top + source.height / 2) / window.innerHeight };
  const palettes = [
    ["#f7df1e", "#39ffdf", "#a855f7", "#ffffff", "#ff79c6"],
    ["#00f5ff", "#0066ff", "#7c3aed", "#f0f9ff", "#22d3ee"],
    ["#ffea00", "#ff8a00", "#ff2d95", "#ffffff", "#a855f7"]
  ];
  const colors = randomItem(palettes); const mobileScale = window.innerWidth < 600 ? 0.62 : 1;
  const options = { colors, disableForReducedMotion: true, resize: true, useWorker: true, zIndex: 300, ticks: Math.round(randomBetween(180, 280)) };
  try {
    const burstCount = Math.floor(randomBetween(3, 6));
    for (let i = 0; i < burstCount; i += 1) {
      window.confetti({
        ...options, particleCount: Math.round(randomBetween(75, 135) * mobileScale),
        spread: randomBetween(90, 300), startVelocity: randomBetween(35, 68),
        decay: randomBetween(0.88, 0.95), gravity: randomBetween(0.55, 1.15),
        drift: randomBetween(-1.1, 1.1), scalar: randomBetween(0.72, 1.35),
        shapes: Math.random() < 0.5 ? ["circle", "square"] : ["square"],
        origin: { x: Math.min(0.95, Math.max(0.05, center.x + randomBetween(-0.12, 0.12))), y: Math.min(0.88, Math.max(0.08, center.y + randomBetween(-0.09, 0.07))) }
      });
    }
    const cannonCount = Math.round(randomBetween(65, 110) * mobileScale);
    window.confetti({ ...options, particleCount: cannonCount, angle: randomBetween(50, 72), spread: randomBetween(55, 95), startVelocity: randomBetween(48, 70), origin: { x: 0.01, y: randomBetween(0.58, 0.86) } });
    window.confetti({ ...options, particleCount: cannonCount, angle: randomBetween(108, 130), spread: randomBetween(55, 95), startVelocity: randomBetween(48, 70), origin: { x: 0.99, y: randomBetween(0.58, 0.86) } });
  } catch (error) { console.warn("紙吹雪エフェクトを開始できませんでした。", error); }
}

function playCorrectEffect() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = $("effectLayer"); const source = $("codeStage").getBoundingClientRect(); const target = $("energyTrack").getBoundingClientRect();
  const sx = source.left + source.width / 2; const sy = source.top + source.height / 2; const tx = target.left + target.width * ((state.index + 1) / SESSION_SIZE); const ty = target.top + target.height / 2;
  const particleCount = window.innerWidth < 600 ? Math.floor(randomBetween(80, 111)) : Math.floor(randomBetween(150, 211)); layer.replaceChildren(); layer.className = "effects effects--active";
  const flash = document.createElement("span"); flash.className = "screen-flash"; layer.append(flash);
  const beam = document.createElement("span"); beam.className = "energy-beam"; beam.style.left = `${sx}px`; beam.style.top = `${sy}px`; beam.style.width = `${Math.hypot(tx - sx, ty - sy)}px`; beam.style.setProperty("--angle", `${Math.atan2(ty - sy, tx - sx)}rad`); layer.append(beam);
  const ringCount = Math.floor(randomBetween(3, 6));
  for (let i = 0; i < ringCount; i += 1) { const ring = document.createElement("span"); ring.className = `shockwave shockwave--${i % 3}`; ring.style.left = `${sx + randomBetween(-10, 10)}px`; ring.style.top = `${sy + randomBetween(-8, 8)}px`; ring.style.setProperty("--ring-delay", `${i * randomBetween(65, 115)}ms`); ring.style.setProperty("--ring-scale", randomBetween(5.5, 10).toFixed(2)); layer.append(ring); }
  const rayCount = window.innerWidth < 600 ? 12 : 22;
  for (let i = 0; i < rayCount; i += 1) { const ray = document.createElement("span"); ray.className = "flare-ray"; ray.style.left = `${sx}px`; ray.style.top = `${sy}px`; ray.style.width = `${randomBetween(90, 300)}px`; ray.style.setProperty("--ray-angle", `${randomBetween(0, Math.PI * 2)}rad`); ray.style.setProperty("--ray-delay", `${randomBetween(0, 180)}ms`); ray.style.setProperty("--ray-duration", `${randomBetween(0.45, 0.95)}s`); layer.append(ray); }
  const shapes = ["dot", "line", "diamond", "star", "ring"];
  for (let i = 0; i < particleCount; i += 1) {
    const particle = document.createElement("i"); const angle = randomBetween(0, Math.PI * 2); const radius = randomBetween(55, window.innerWidth < 600 ? 175 : 285); const free = Math.random() < 0.32;
    const ox = sx + randomBetween(-source.width * 0.18, source.width * 0.18); const oy = sy + randomBetween(-source.height * 0.14, source.height * 0.14); const size = randomBetween(3, 12);
    particle.className = `burst burst--${i % 3} burst--${randomItem(shapes)}${free ? " burst--free" : ""}`;
    particle.style.setProperty("--x", `${ox}px`); particle.style.setProperty("--y", `${oy}px`); particle.style.setProperty("--size", `${size}px`); particle.style.setProperty("--height", `${size * randomBetween(0.35, 2.7)}px`);
    particle.style.setProperty("--bx", `${Math.cos(angle) * radius}px`); particle.style.setProperty("--by", `${Math.sin(angle) * radius}px`);
    particle.style.setProperty("--tx", `${tx - ox + randomBetween(-16, 16)}px`); particle.style.setProperty("--ty", `${ty - oy + randomBetween(-8, 8)}px`);
    particle.style.setProperty("--fx", `${Math.cos(angle) * radius * randomBetween(1.2, 2.2)}px`); particle.style.setProperty("--fy", `${Math.sin(angle) * radius * randomBetween(1.1, 1.8) + randomBetween(30, 150)}px`);
    const spin = randomBetween(-720, 720); particle.style.setProperty("--delay", `${randomBetween(0, 210)}ms`); particle.style.setProperty("--duration", `${randomBetween(0.95, 1.75)}s`); particle.style.setProperty("--mid-scale", randomBetween(0.7, 2.1).toFixed(2)); particle.style.setProperty("--spin-mid", `${spin * 0.45}deg`); particle.style.setProperty("--spin", `${spin}deg`); layer.append(particle);
  }
  const impact = document.createElement("span"); impact.className = "impact"; impact.style.left = `${tx}px`; impact.style.top = `${ty}px`; layer.append(impact);
  $("codeCard").classList.remove("code-card--correct"); void $("codeCard").offsetWidth; $("codeCard").classList.add("code-card--correct");
  $("energyTrack").classList.remove("energy__track--hit"); void $("energyTrack").offsetWidth; $("energyTrack").classList.add("energy__track--hit");
  playConfettiShow(source); window.setTimeout(() => { layer.replaceChildren(); layer.className = ""; $("energyTrack").classList.remove("energy__track--hit"); }, 2300);
}

state.levels = Array.isArray(window.LEVELS) ? window.LEVELS : [];
if (validateLevels(state.levels)) renderLevels(); else $("levelList").textContent = "問題データにエラーがあります。コンソールを確認してください。";
$("actionButton").addEventListener("click", handleAction); $("restartButton").addEventListener("click", () => startSession(state.selectedLevel)); $("quizBackButton").addEventListener("click", showLevels); $("backToLevelsButton").addEventListener("click", showLevels);
