"use strict";

/* =========================================================
 * Magic Number
 * ========================================================= */

/**
 * 「＝を押した瞬間 + 1分」を MMDDHHmm の8桁文字列で返す。
 * - 端末のローカル時刻だけを使う（外部 API なし）
 * - 1分後の時刻は Date に 60,000ms を足して作るので、
 *   23:59 → 翌日 00:00、12/31 → 1/1、月末・うるう年も Date が正しく繰り上げる
 * - 数値ではなく文字列で返すので、先頭の 0 が消えない
 */
function generateMagicNumber(now = new Date()) {
  const oneMinuteLater = new Date(now.getTime() + 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    pad(oneMinuteLater.getMonth() + 1) +
    pad(oneMinuteLater.getDate()) +
    pad(oneMinuteLater.getHours()) +
    pad(oneMinuteLater.getMinutes())
  );
}

/* =========================================================
 * 電卓ロジック（手品用に足し算のみ）
 * 使うキー: 数字 / 小数点 / ＋/− / ＋ / ＝ / AC・C
 * × ÷ − % は見た目だけで、押しても何も起きない
 * ========================================================= */

const MAX_INPUT_DIGITS = 9;

const state = {
  displayText: "0",
  input: null,
  displayedValue: 0,
  runningTotal: null,
  isAwaitingOperand: false,
  isAddSelected: false,
  showsAllClear: true,
  isMagicModeEnabled: false,
  expressionParts: [],
  historyText: "",
};

function currentValue() {
  if (state.input !== null) {
    const value = parseFloat(state.input);
    if (Number.isFinite(value)) return value;
  }
  return state.displayedValue;
}

function press(key) {
  if (/^[0-9]$/.test(key)) {
    inputDigit(key);
  } else {
    switch (key) {
      case "decimal": inputDecimal(); break;
      case "toggleSign": toggleSign(); break;
      case "add": add(); break;
      case "equals": performEquals(); break;
      case "clear": clear(); break;
      default:
        return;
    }
  }
  render();
}

function enableMagicMode() {
  state.isMagicModeEnabled = true;
}

function inputDigit(digit) {
  if (state.input === null) {
    startInput(digit);
    return;
  }
  let text = state.input;
  if (text.replace(/[^0-9]/g, "").length >= MAX_INPUT_DIGITS) return;

  if (text === "0") text = digit;
  else if (text === "-0") text = "-" + digit;
  else text += digit;
  setInput(text);
}

function inputDecimal() {
  if (state.input === null) {
    startInput("0.");
    return;
  }
  if (!state.input.includes(".")) setInput(state.input + ".");
}

function toggleSign() {
  if (state.input !== null) {
    setInput(state.input.startsWith("-") ? state.input.slice(1) : "-" + state.input);
  } else if (state.isAwaitingOperand) {
    startInput("-0");
  } else {
    showResult(-state.displayedValue);
  }
}

function add() {
  if (state.isAwaitingOperand && state.input === null) return;

  const operandText = state.input !== null
    ? formatInput(state.input)
    : formatResult(state.displayedValue);

  state.expressionParts.push(operandText, "+");
  state.historyText = "";

  let total = currentValue();
  if (state.runningTotal !== null) total += state.runningTotal;

  showResult(total);
  state.runningTotal = total;
  state.isAwaitingOperand = true;
  state.isAddSelected = true;
}

function performEquals() {
  if (state.isMagicModeEnabled) {
    showMagicNumber();
    return;
  }

  const finalParts = [...state.expressionParts];
  if (state.input !== null) {
    finalParts.push(formatInput(state.input));
  } else if (finalParts[finalParts.length - 1] === "+") {
    finalParts.pop();
  }

  let total = currentValue();
  if (state.runningTotal !== null) {
    total = (state.isAwaitingOperand && state.input === null)
      ? state.runningTotal
      : state.runningTotal + total;
  }

  state.historyText = finalParts.length ? finalParts.join(" ") + " =" : "";
  resetCalculation();
  showResult(total);
}

function clear() {
  if (state.showsAllClear) {
    resetCalculation();
    state.historyText = "";
    state.displayText = "0";
    return;
  }

  state.input = null;
  state.displayedValue = 0;
  state.displayText = "0";
  state.showsAllClear = true;
  if (state.runningTotal !== null) {
    state.isAddSelected = true;
    state.isAwaitingOperand = true;
  }
}

function showMagicNumber() {
  const magicNumber = generateMagicNumber(new Date());

  const finalParts = [...state.expressionParts];
  if (state.input !== null) {
    finalParts.push(formatInput(state.input));
  } else if (finalParts[finalParts.length - 1] === "+") {
    finalParts.pop();
  }
  state.historyText = finalParts.length ? finalParts.join(" ") + " =" : "";

  resetCalculation();
  state.isMagicModeEnabled = false;

  state.displayedValue = Number(magicNumber);
  state.displayText = magicNumber;
}

function startInput(text) {
  if (state.showsAllClear && state.runningTotal === null && state.input === null) {
    state.historyText = "";
    state.expressionParts = [];
  }
  state.isAwaitingOperand = false;
  state.isAddSelected = false;
  state.showsAllClear = false;
  setInput(text);
}

function setInput(text) {
  state.input = text;
  state.displayText = formatInput(text);
}

function showResult(value) {
  state.input = null;
  state.isAwaitingOperand = false;
  state.displayedValue = value;
  state.displayText = formatResult(value);
}

function resetCalculation() {
  state.input = null;
  state.displayedValue = 0;
  state.runningTotal = null;
  state.isAwaitingOperand = false;
  state.isAddSelected = false;
  state.showsAllClear = true;
  state.expressionParts = [];
}

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatInput(text) {
  let sign = "";
  let body = text;
  if (body.startsWith("-")) {
    sign = "-";
    body = body.slice(1);
  }
  const dot = body.indexOf(".");
  if (dot === -1) return sign + groupThousands(body);
  return sign + groupThousands(body.slice(0, dot)) + "." + body.slice(dot + 1);
}

function formatResult(value) {
  if (!Number.isFinite(value) || value === 0) return "0";

  const magnitude = Math.abs(value);
  if (magnitude >= 1e9 || magnitude < 1e-8) {
    const [mantissa, exponent] = value.toExponential(5).split("e");
    const trimmed = mantissa.includes(".") ? mantissa.replace(/\.?0+$/, "") : mantissa;
    return trimmed + "e" + exponent.replace("+", "");
  }

  const integerDigits = magnitude < 1 ? 1 : Math.floor(Math.log10(magnitude)) + 1;
  const fractionDigits = Math.max(0, MAX_INPUT_DIGITS - integerDigits);
  let text = value.toFixed(fractionDigits);
  if (text.includes(".")) text = text.replace(/\.?0+$/, "");

  const sign = text.startsWith("-") ? "-" : "";
  if (sign) text = text.slice(1);
  if (text === "0") return "0";
  const [intPart, fracPart] = text.split(".");
  return sign + groupThousands(intPart) + (fracPart ? "." + fracPart : "");
}

/* =========================================================
 * 画面
 * ========================================================= */

const app = document.getElementById("app");
const display = document.getElementById("display");
const calculationHistory = document.getElementById("calculation-history");
const displayText = document.getElementById("display-text");
const clearLabel = document.querySelector("#clear-key .label");
const clearKey = document.getElementById("clear-key");
const addKey = document.getElementById("add-key");

let displayBaseFontSize = 92;

function historyForDisplay() {
  if (state.input !== null && state.expressionParts.length) {
    return [...state.expressionParts, formatInput(state.input)].join(" ");
  }
  if (state.expressionParts.length) return state.expressionParts.join(" ");
  return state.historyText;
}

function render() {
  calculationHistory.textContent = historyForDisplay();
  displayText.textContent = state.displayText;
  clearLabel.textContent = state.showsAllClear ? "AC" : "C";
  clearKey.setAttribute("aria-label", state.showsAllClear ? "オールクリア" : "クリア");
  addKey.classList.toggle("selected", state.isAddSelected);
  fitDisplay();
}

function fitDisplay() {
  displayText.style.fontSize = displayBaseFontSize + "px";
  const styles = getComputedStyle(display);
  const available =
    display.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  const needed = displayText.getBoundingClientRect().width;
  if (needed > available && needed > 0) {
    const size = Math.max(displayBaseFontSize * (available / needed) * 0.98, displayBaseFontSize * 0.3);
    displayText.style.fontSize = size + "px";
  }
}

function layout() {
  const width = app.clientWidth;
  const height = app.clientHeight;
  if (!width || !height) return;

  const bodyStyles = getComputedStyle(document.body);
  const hasHomeIndicator = parseFloat(bodyStyles.paddingBottom) > 0;

  const gap = Math.min(Math.max(width * 0.04, 10), 17);
  const bottomPad = hasHomeIndicator ? gap * 0.35 : gap;
  const widthBased = (width - gap * 2 - gap * 3) / 4;
  const heightBased = (height - bottomPad - gap * 4) / (5 + 1.6);
  const btn = Math.max(Math.min(widthBased, heightBased, 90), 44);

  const root = document.documentElement.style;
  root.setProperty("--btn", btn + "px");
  root.setProperty("--gap", gap + "px");
  root.setProperty("--bottom-pad", bottomPad + "px");
  root.setProperty("--display-pad", gap + btn * 0.12 + "px");

  displayBaseFontSize = btn * 1.15;
  fitDisplay();
}

/* ---------- ボタン操作 ---------- */

function setUpKeys() {
  const pressedByPointer = new Map();

  function release(pointerId, shouldFire, x, y) {
    const key = pressedByPointer.get(pointerId);
    if (!key) return;
    pressedByPointer.delete(pointerId);
    key.classList.remove("pressed");

    if (!shouldFire) return;
    const rect = key.getBoundingClientRect();
    const slop = 12;
    const inside =
      x >= rect.left - slop && x <= rect.right + slop &&
      y >= rect.top - slop && y <= rect.bottom + slop;
    if (inside) press(key.dataset.key);
  }

  document.querySelectorAll(".key").forEach((key) => {
    key.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      pressedByPointer.set(event.pointerId, key);
      key.classList.add("pressed");
      try { key.setPointerCapture(event.pointerId); } catch (_) {}
    });
    key.addEventListener("pointerup", (event) => {
      release(event.pointerId, true, event.clientX, event.clientY);
    });
    key.addEventListener("pointercancel", (event) => {
      release(event.pointerId, false, 0, 0);
    });
    key.addEventListener("lostpointercapture", (event) => {
      release(event.pointerId, false, 0, 0);
    });
    key.addEventListener("contextmenu", (event) => event.preventDefault());
  });
}

/* ---------- 3本指タップ（Magic Mode） ---------- */

function setUpThreeFingerTap() {
  const MAX_START_SPREAD_MS = 250;
  const MAX_DURATION_MS = 600;
  const MAX_MOVE_PX = 24;

  let gesture = null;

  function reset() {
    gesture = null;
  }

  display.addEventListener("touchstart", (event) => {
    event.preventDefault();
    const now = performance.now();

    const allInDisplay = Array.from(event.touches).every((t) => display.contains(t.target));

    if (!gesture) {
      gesture = { startTime: now, starts: new Map(), maxTouches: 0, valid: true };
    }
    if (!allInDisplay) gesture.valid = false;

    for (const touch of event.changedTouches) {
      gesture.starts.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    gesture.maxTouches = Math.max(gesture.maxTouches, event.touches.length);

    if (gesture.maxTouches > 3) gesture.valid = false;
    if (gesture.maxTouches < 3 && now - gesture.startTime > MAX_START_SPREAD_MS) gesture.valid = false;
    if (event.touches.length === 3 && now - gesture.startTime > MAX_START_SPREAD_MS) gesture.valid = false;
  }, { passive: false });

  display.addEventListener("touchmove", (event) => {
    event.preventDefault();
    if (!gesture) return;
    for (const touch of event.changedTouches) {
      const start = gesture.starts.get(touch.identifier);
      if (!start) continue;
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > MAX_MOVE_PX) {
        gesture.valid = false;
      }
    }
  }, { passive: false });

  display.addEventListener("touchend", (event) => {
    event.preventDefault();
    if (!gesture) return;
    if (event.touches.length > 0) return;

    const duration = performance.now() - gesture.startTime;
    const isThreeFingerTap =
      gesture.valid &&
      gesture.maxTouches === 3 &&
      gesture.starts.size === 3 &&
      duration <= MAX_DURATION_MS;

    reset();
    if (isThreeFingerTap) enableMagicMode();
  }, { passive: false });

  display.addEventListener("touchcancel", reset);
}

function suppressBrowserGestures() {
  const prevent = (event) => event.preventDefault();

  document.addEventListener("touchmove", prevent, { passive: false });
  document.addEventListener("gesturestart", prevent, { passive: false });
  document.addEventListener("gesturechange", prevent, { passive: false });
  document.addEventListener("gestureend", prevent, { passive: false });
  document.addEventListener("dblclick", prevent, { passive: false });
  document.addEventListener("selectstart", prevent);
  document.addEventListener("contextmenu", prevent);
}

setUpKeys();
setUpThreeFingerTap();
suppressBrowserGestures();

window.addEventListener("resize", layout);
window.addEventListener("orientationchange", () => setTimeout(layout, 200));
if (window.visualViewport) window.visualViewport.addEventListener("resize", layout);

layout();
render();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
