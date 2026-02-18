function setYear() {
  document.getElementById("year").textContent = new Date().getFullYear();
}

function copyText(text, msgEl) {
  navigator.clipboard.writeText(text).then(() => {
    if (msgEl) msgEl.textContent = "Copied.";
    setTimeout(() => { if (msgEl) msgEl.textContent = ""; }, 1500);
  }).catch(() => {
    if (msgEl) msgEl.textContent = "Copy failed. Select and copy manually.";
  });
}

function randomDemo() {
  const weights = [55, 62, 70, 78, 85, 92];
  const goals = [-1, 0, 1];
  const w = weights[Math.floor(Math.random() * weights.length)];
  const g = goals[Math.floor(Math.random() * goals.length)];

  // mimic your MVP heuristic for display purposes
  let base = Math.round(30 * w);
  let cal = base + (g === -1 ? -500 : (g === 1 ? 300 : 0));
  cal = Math.max(1200, Math.min(4500, cal));

  const protein = Math.round(1.6 * w);
  const fat = Math.round(0.8 * w);
  const carbs = Math.max(0, Math.floor((cal - (protein * 4 + fat * 9)) / 4));

  const out = `Weight (kg): ${w}
Goal (-1 loss, 0 maintain, 1 gain): ${g}

Daily target:
Calories: ${cal}
Protein:  ${protein} g
Carbs:    ${carbs} g
Fat:      ${fat} g`;

  document.getElementById("demoOut").textContent = out;
}

document.addEventListener("DOMContentLoaded", () => {
  setYear();

  const cmd = `cmake -S c_core -B c_core/build
cmake --build c_core/build
ctest --test-dir c_core/build --output-on-failure
./c_core/build/cli_demo`;

  document.getElementById("copyCmd")?.addEventListener("click", () => {
    copyText(cmd, document.getElementById("copiedMsg"));
  });

  document.getElementById("copyBuild")?.addEventListener("click", () => {
    copyText(cmd, document.getElementById("copiedMsg"));
  });

  document.getElementById("randomize")?.addEventListener("click", randomDemo);
});