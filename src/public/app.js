// --- State ---
let isRegisterMode = false;
let captchaWidgetId = null;
window.onRecaptchaLoad = function() {
  const container = document.getElementById('recaptcha-container');
  if (container && window.grecaptcha && grecaptcha.render) {
    // avoid double render
    if (captchaWidgetId === null) {
      captchaWidgetId = grecaptcha.render('recaptcha-container', { sitekey: '6Ld5uAAtAAAAAAFY8f6MPA65EK_Wuy2x6WluyWp4' });
    }
  }
};

// --- Helpers ---
function difficultyBadge(value) {
  const d = CONFIG.DIFFICULTIES.find((x) => x.value === value);
  if (!d) return "";
  return `<span class="badge-difficulty ${d.className}">${d.label}</span>`;
}

function getCurrentUserId() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.id;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem(CONFIG.STORAGE_KEY);
}

function setToken(token) {
  localStorage.setItem(CONFIG.STORAGE_KEY, token);
}

function removeToken() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
}

async function apiFetch(route, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = { ...options.headers };
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${CONFIG.API_URL}${route}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.msg || "Request failed");
  return data;
}

// --- Auth ---
function showAuth() {
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("app-section").style.display = "none";
  document.getElementById("logout-btn").style.display = "none";
  renderAuthForm();
}

function renderAuthForm() {
  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const title = isRegisterMode ? "Sign Up" : "Log In";
  const switchText = isRegisterMode
    ? 'Already have an account? <a href="#" id="switch-mode">Log in</a>'
    : 'Don\'t have an account? <a href="#" id="switch-mode">Sign up</a>';

  const formHTML = `
    <h2>${title}</h2>
    <form id="auth-form" method="POST">
      ${fields
        .map((f) => {
          const type =
            f === "password" ? "password" : f === "email" ? "email" : "text";
          const label = f.charAt(0).toUpperCase() + f.slice(1);
          return `
          <div class="form-group">
            <label for="${f}">${label}</label>
            <input type="${type}" id="${f}" name="${f}" required />
          </div>`;
        })
        .join("")}
      ${isRegisterMode ? '<div id="recaptcha-container"></div>' : ''}
      <button type="submit">${title}</button>
    </form>
    <p class="switch-text">${switchText}</p>
    <p id="auth-error" class="error"></p>
  `;

  document.getElementById("auth-section").innerHTML = formHTML;
  document.getElementById("auth-form").addEventListener("submit", handleAuth);
  document.getElementById("switch-mode").addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    renderAuthForm();
  });

  // reset any previous captcha widget id when re-rendering
  if (window.grecaptcha && captchaWidgetId !== null) {
    try { grecaptcha.reset(captchaWidgetId); } catch (err) {}
    captchaWidgetId = null;
  }

  // render captcha if in register mode and grecaptcha is available
  if (isRegisterMode) {
    const container = document.getElementById('recaptcha-container');
    if (container && window.grecaptcha && grecaptcha.render) {
      captchaWidgetId = grecaptcha.render('recaptcha-container', { sitekey: '6Ld5uAAtAAAAAAFY8f6MPA65EK_Wuy2x6WluyWp4' });
    }
  }
}

async function handleAuth(e) {
  e.preventDefault();
  const errorEl = document.getElementById("auth-error");
  errorEl.textContent = "";

  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const route = isRegisterMode ? CONFIG.ROUTES.REGISTER : CONFIG.ROUTES.LOGIN;

  const body = {};
  fields.forEach((f) => {
    body[f] = document.getElementById(f).value;
  });

  // include captcha response when registering
  if (isRegisterMode) {
    let captchaResponse = null;
    if (window.grecaptcha) {
      try {
        captchaResponse = captchaWidgetId !== null ? grecaptcha.getResponse(captchaWidgetId) : grecaptcha.getResponse();
      } catch (err) {
        captchaResponse = null;
      }
    }
    body["g-recaptcha-response"] = captchaResponse;
  }

  try {
    const data = await apiFetch(route, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setToken(data.token);
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// --- App ---
async function showApp() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("app-section").style.display = "block";
  document.getElementById("logout-btn").style.display = "inline-block";
  await loadQuestions();
}

async function loadQuestions(keyword = "", page = 1, difficulty = "") {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading questions...</p>';

  try {
    const params = new URLSearchParams({
      page,
      limit: CONFIG.QUESTIONS_PER_PAGE,
    });
    if (keyword) params.set("keyword", keyword);
    if (difficulty) params.set("difficulty", difficulty);
    const result = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}?${params}`);
    const { data: questions, total, totalPages } = result;
    const currentUserId = getCurrentUserId();

    const solvedCount = questions.filter(
      (q) => q[CONFIG.API_FIELDS.SOLVED],
    ).length;

    let html = `
      <div class="score-bar">
        <div class="score-item">
          <div class="score-value">${total}</div>
          <div class="score-label">Questions</div>
        </div>
        <div class="score-item">
          <div class="score-value">${solvedCount}/${questions.length}</div>
          <div class="score-label">Solved (this page)</div>
        </div>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" id="new-question-btn">+ New Question</button>
        <div class="search-bar">
          <select id="difficulty-filter" class="difficulty-filter">
            <option value="">All difficulties</option>
            ${CONFIG.DIFFICULTIES.map(
              (d) =>
                `<option value="${d.value}" ${difficulty === d.value ? "selected" : ""}>${d.label}</option>`,
            ).join("")}
          </select>
          <input type="text" id="keyword-input" placeholder="Search by keyword..." value="${keyword}" />
          <button class="btn btn-search" id="search-btn">Search</button>
          ${keyword || difficulty ? `<button class="btn btn-clear" id="clear-btn">Clear</button>` : ""}
        </div>
      </div>`;

    if (questions.length === 0) {
      html +=
        '<p class="empty-state">No questions found. Create one to get started!</p>';
    } else {
      html += questions
        .map(
          (q) => `
        <article class="question-card ${q[CONFIG.API_FIELDS.SOLVED] ? "solved-card" : ""}">
          <h3>
            <a href="#" class="question-link" data-id="${q.id}">${q.question}</a>
            ${difficultyBadge(q.difficulty)}
            ${q.type === "MULTIPLE_CHOICE" ? `<span class="badge-mc">Multiple choice</span>` : ""}
            ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge-solved">Solved</span>` : ""}
          </h3>
          ${
            q.keywords && q.keywords.length
              ? `<div class="question-keywords">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
              : ""
          }
          <div class="question-actions">
            <span>
              <button class="btn btn-play" data-id="${q.id}">Play</button>
              <a href="#" class="read-more" data-id="${q.id}">See answer</a>
            </span>
            ${
              q.userId === currentUserId
                ? `<span class="owner-actions">
                    <button class="btn btn-edit" data-id="${q.id}">Edit</button>
                    <button class="btn btn-delete" data-id="${q.id}">Delete</button>
                  </span>`
                : ""
            }
          </div>
        </article>`,
        )
        .join("");
    }

    if (totalPages > 1) {
      html += `
        <div class="pagination">
          <button class="btn btn-page" id="prev-btn" ${page <= 1 ? "disabled" : ""}>Previous</button>
          <span class="page-info">Page ${page} of ${totalPages}</span>
          <button class="btn btn-page" id="next-btn" ${page >= totalPages ? "disabled" : ""}>Next</button>
        </div>`;
    }

    container.innerHTML = html;

    document
      .getElementById("new-question-btn")
      .addEventListener("click", () => showQuestionForm());

    const getFilterDifficulty = () =>
      document.getElementById("difficulty-filter").value;

    document.getElementById("search-btn").addEventListener("click", () => {
      loadQuestions(
        document.getElementById("keyword-input").value.trim(),
        1,
        getFilterDifficulty(),
      );
    });

    document
      .getElementById("keyword-input")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter")
          loadQuestions(e.target.value.trim(), 1, getFilterDifficulty());
      });

    document
      .getElementById("difficulty-filter")
      .addEventListener("change", (e) => {
        loadQuestions(
          document.getElementById("keyword-input").value.trim(),
          1,
          e.target.value,
        );
      });

    const clearBtn = document.getElementById("clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", () => loadQuestions());

    const prevBtn = document.getElementById("prev-btn");
    if (prevBtn)
      prevBtn.addEventListener("click", () =>
        loadQuestions(keyword, page - 1, difficulty),
      );

    const nextBtn = document.getElementById("next-btn");
    if (nextBtn)
      nextBtn.addEventListener("click", () =>
        loadQuestions(keyword, page + 1, difficulty),
      );

    container.querySelectorAll(".question-link, .read-more").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        loadQuestionDetail(el.dataset.id);
      });
    });

    container.querySelectorAll(".btn-edit").forEach((el) => {
      el.addEventListener("click", () => showQuestionForm(el.dataset.id));
    });

    container.querySelectorAll(".btn-delete").forEach((el) => {
      el.addEventListener("click", () => deleteQuestion(el.dataset.id));
    });

    container.querySelectorAll(".btn-play").forEach((el) => {
      el.addEventListener("click", () => playQuestion(el.dataset.id));
    });
  } catch (err) {
    if (
      err.message === "No token provided" ||
      err.message === "Invalid or expired token"
    ) {
      removeToken();
      showAuth();
      return;
    }
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function loadQuestionDetail(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    const currentUserId = getCurrentUserId();
    const isOwner = q.userId === currentUserId;

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
      <article class="question-card question-detail">
        <h3>${q.question}
          ${difficultyBadge(q.difficulty)}
          ${q.type === "MULTIPLE_CHOICE" ? `<span class="badge-mc">Multiple choice</span>` : ""}
          ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge-solved">Solved</span>` : ""}
        </h3>
        <p class="question-meta">by ${q.userName || "Unknown"}</p>
        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="">` : ""}
        <p class="question-answer">${q.answer}</p>
        ${
          q.type === "MULTIPLE_CHOICE" && q.choices && q.choices.length
            ? `<ul class="choice-list">${q.choices
                .map(
                  (c) =>
                    `<li class="choice-item ${c.text === q.answer ? "choice-correct" : ""}">${c.text}${c.text === q.answer ? " <span class=\"choice-tag\">correct</span>" : ""}</li>`,
                )
                .join("")}</ul>`
            : ""
        }
        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
            : ""
        }
        ${
          isOwner
            ? `<div class="question-actions detail-actions">
                <button class="btn btn-edit" id="detail-edit-btn">Edit</button>
                <button class="btn btn-delete" id="detail-delete-btn">Delete</button>
              </div>`
            : ""
        }
      </article>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    if (isOwner) {
      document
        .getElementById("detail-edit-btn")
        .addEventListener("click", () => showQuestionForm(qId));
      document
        .getElementById("detail-delete-btn")
        .addEventListener("click", () => deleteQuestion(qId));
    }
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Create / Edit ---
const MAX_CHOICES = 4;
const MIN_CHOICES = 2;

function renderChoiceRow(idx, text = "", checked = false) {
  return `
    <div class="choice-row" data-row="${idx}">
      <input type="radio" name="q-choice-correct" value="${idx}" ${checked ? "checked" : ""} aria-label="Mark as correct" />
      <input type="text" class="q-choice-text" placeholder="Choice ${idx + 1}" value="${text.replace(/"/g, "&quot;")}" />
      <button type="button" class="btn btn-clear remove-choice-btn" title="Remove">&times;</button>
    </div>`;
}

async function showQuestionForm(qId) {
  const container = document.getElementById("questions-container");
  const isEdit = !!qId;
  let q = {
    question: "",
    answer: "",
    keywords: [],
    type: "TEXT",
    choices: [],
    difficulty: "EASY",
  };

  if (isEdit) {
    try {
      q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    } catch (err) {
      container.innerHTML = `<p class="error">${err.message}</p>`;
      return;
    }
  }

  const initialType = q.type === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE" : "TEXT";
  const initialChoices =
    initialType === "MULTIPLE_CHOICE" && q.choices && q.choices.length
      ? q.choices
      : [{ text: "", isCorrect: true }, { text: "", isCorrect: false }];

  container.innerHTML = `
    <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
    <div class="question-form-wrapper">
      <h2>${isEdit ? "Edit Question" : "New Question"}</h2>
      <form id="question-form" enctype="multipart/form-data">
        <div class="form-group">
          <label>Question type</label>
          <div class="type-toggle">
            <label><input type="radio" name="q-type" value="TEXT" ${initialType === "TEXT" ? "checked" : ""}/> Text</label>
            <label><input type="radio" name="q-type" value="MULTIPLE_CHOICE" ${initialType === "MULTIPLE_CHOICE" ? "checked" : ""}/> Multiple choice</label>
          </div>
        </div>
        <div class="form-group">
          <label for="q-question">Question</label>
          <input type="text" id="q-question" value="${q.question.replace(/"/g, "&quot;")}" required />
        </div>
        <div class="form-group">
          <label for="q-difficulty">Difficulty</label>
          <select id="q-difficulty" class="difficulty-filter">
            ${CONFIG.DIFFICULTIES.map(
              (d) =>
                `<option value="${d.value}" ${(q.difficulty || "EASY") === d.value ? "selected" : ""}>${d.label}</option>`,
            ).join("")}
          </select>
        </div>
        <div class="form-group" id="text-answer-group">
          <label for="q-answer">Answer</label>
          <textarea id="q-answer" rows="4">${q.answer || ""}</textarea>
        </div>
        <div class="form-group" id="choices-group">
          <label>Choices (${MIN_CHOICES}-${MAX_CHOICES}, pick the correct one)</label>
          <div id="choices-list">
            ${initialChoices
              .map((c, i) => renderChoiceRow(i, c.text || "", !!c.isCorrect))
              .join("")}
          </div>
          <button type="button" id="add-choice-btn" class="btn btn-edit">+ Add choice</button>
        </div>
        <div class="form-group">
          <label for="q-keywords">Keywords (comma-separated)</label>
          <input type="text" id="q-keywords" value="${q.keywords ? q.keywords.join(", ") : ""}" />
        </div>
        <div class="form-group">
          <label for="q-image">Image ${isEdit ? "(leave blank to keep current)" : "(optional)"}</label>
          <input type="file" id="q-image" accept="image/*" />
          ${isEdit && q.imageUrl ? `<img src="${q.imageUrl}" alt="" style="max-width:200px;margin-top:0.5rem;border-radius:4px" />` : ""}
        </div>
        <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Create Question"}</button>
      </form>
      <p id="question-form-error" class="error"></p>
    </div>`;

  document.getElementById("back-btn").addEventListener("click", (e) => {
    e.preventDefault();
    loadQuestions();
  });

  const textGroup = document.getElementById("text-answer-group");
  const choicesGroup = document.getElementById("choices-group");
  const choicesList = document.getElementById("choices-list");
  const addBtn = document.getElementById("add-choice-btn");
  const answerEl = document.getElementById("q-answer");

  function applyType() {
    const t = document.querySelector('input[name="q-type"]:checked').value;
    if (t === "MULTIPLE_CHOICE") {
      textGroup.style.display = "none";
      choicesGroup.style.display = "";
      answerEl.required = false;
    } else {
      textGroup.style.display = "";
      choicesGroup.style.display = "none";
      answerEl.required = true;
    }
  }

  function reindexChoices() {
    const rows = choicesList.querySelectorAll(".choice-row");
    rows.forEach((row, i) => {
      row.dataset.row = i;
      const radio = row.querySelector('input[type="radio"]');
      radio.value = i;
      const textInput = row.querySelector(".q-choice-text");
      textInput.placeholder = `Choice ${i + 1}`;
    });
    addBtn.disabled = rows.length >= MAX_CHOICES;
  }

  function ensureOneChecked() {
    const radios = choicesList.querySelectorAll('input[type="radio"]');
    if (radios.length && !Array.from(radios).some((r) => r.checked)) {
      radios[0].checked = true;
    }
  }

  document
    .querySelectorAll('input[name="q-type"]')
    .forEach((el) => el.addEventListener("change", applyType));

  addBtn.addEventListener("click", () => {
    const count = choicesList.querySelectorAll(".choice-row").length;
    if (count >= MAX_CHOICES) return;
    choicesList.insertAdjacentHTML("beforeend", renderChoiceRow(count));
    reindexChoices();
  });

  choicesList.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-choice-btn")) {
      const rows = choicesList.querySelectorAll(".choice-row");
      if (rows.length <= MIN_CHOICES) return;
      e.target.closest(".choice-row").remove();
      reindexChoices();
      ensureOneChecked();
    }
  });

  applyType();
  reindexChoices();
  ensureOneChecked();

  document
    .getElementById("question-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("question-form-error");
      errorEl.textContent = "";

      const type = document.querySelector('input[name="q-type"]:checked').value;
      const body = new FormData();
      body.append("type", type);
      body.append("question", document.getElementById("q-question").value);
      body.append("difficulty", document.getElementById("q-difficulty").value);
      body.append("keywords", document.getElementById("q-keywords").value);

      if (type === "MULTIPLE_CHOICE") {
        const rows = Array.from(choicesList.querySelectorAll(".choice-row"));
        const choices = rows.map((row) => ({
          text: row.querySelector(".q-choice-text").value.trim(),
          isCorrect: row.querySelector('input[type="radio"]').checked,
        }));
        if (choices.some((c) => !c.text)) {
          errorEl.textContent = "All choices must have text";
          return;
        }
        if (choices.filter((c) => c.isCorrect).length !== 1) {
          errorEl.textContent = "Pick exactly one correct choice";
          return;
        }
        body.append("choices", JSON.stringify(choices));
      } else {
        body.append("answer", document.getElementById("q-answer").value);
      }

      const imageFile = document.getElementById("q-image").files[0];
      if (imageFile) body.append("image", imageFile);

      try {
        if (isEdit) {
          await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, {
            method: "PUT",
            body,
          });
        } else {
          await apiFetch(CONFIG.ROUTES.QUESTIONS, { method: "POST", body });
        }
        loadQuestions();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
}

// --- Play ---
async function playQuestion(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);

    const isMC = q.type === "MULTIPLE_CHOICE";
    const answerFieldHtml = isMC
      ? `<div class="form-group">
          <label>Pick the correct answer</label>
          <div class="play-choices">
            ${(q.choices || [])
              .map(
                (c) => `
              <label class="play-choice">
                <input type="radio" name="play-choice" value="${c.id}" required />
                <span>${c.text}</span>
              </label>`,
              )
              .join("")}
          </div>
        </div>`
      : `<div class="form-group">
          <label for="play-answer">Your answer</label>
          <textarea id="play-answer" rows="3" required></textarea>
        </div>`;

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
      <div class="question-form-wrapper" style="text-align:center">
        <div class="play-question-text">${q.question}</div>
        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="" style="margin:0 auto 1rem">` : ""}
        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords" style="justify-content:center;margin-bottom:1.5rem">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
            : ""
        }
        <form id="play-form" style="text-align:left">
          ${answerFieldHtml}
          <div style="text-align:center">
            <button type="submit" class="btn btn-play" style="padding:0.7rem 2.5rem;font-size:1rem">Submit</button>
          </div>
        </form>
        <div id="play-result"></div>
        <p id="play-error" class="error"></p>
      </div>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    document
      .getElementById("play-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById("play-error");
        const resultEl = document.getElementById("play-result");
        errorEl.textContent = "";
        resultEl.innerHTML = "";

        let payload;
        if (isMC) {
          const picked = document.querySelector(
            'input[name="play-choice"]:checked',
          );
          if (!picked) {
            errorEl.textContent = "Pick a choice";
            return;
          }
          payload = { choiceId: Number(picked.value) };
        } else {
          payload = { answer: document.getElementById("play-answer").value };
        }

        try {
          const result = await apiFetch(
            `${CONFIG.ROUTES.QUESTIONS}/${qId}/play`,
            {
              method: "POST",
              body: JSON.stringify(payload),
            },
          );

          if (result.correct) {
            resultEl.innerHTML = `<div class="play-result correct">Correct!</div>`;
          } else {
            resultEl.innerHTML = `
            <div class="play-result incorrect">
              Incorrect! The answer was: <strong>${result.correctAnswer}</strong>
            </div>`;
          }
        } catch (err) {
          errorEl.textContent = err.message;
        }
      });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Delete ---
async function deleteQuestion(qId) {
  if (!confirm("Are you sure you want to delete this question?")) return;

  try {
    await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, { method: "DELETE" });
    loadQuestions();
  } catch (err) {
    alert(err.message);
  }
}

function handleLogout() {
  removeToken();
  showAuth();
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  if (getToken()) {
    showApp();
  } else {
    showAuth();
  }
});
