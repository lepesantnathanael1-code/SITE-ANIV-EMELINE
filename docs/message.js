const form = document.querySelector("#message-form");
const statusText = document.querySelector("#status");
const savedPerson = document.querySelector("#saved-person");
const recentMessages = document.querySelector("#recent-messages");
const toast = document.querySelector("#toast");
const toastTitle = document.querySelector("#toast-title");
const toastText = document.querySelector("#toast-text");
const db = window.supabase?.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

let visitorIpHash = "";
let savedIdentity = null;
const bannedWords = ["pute", "salope", "connard", "connasse", "fdp", "encule", "enculé", "ntm", "tg"];

function clean(value) {
  return value.trim().replace(/\s+/g, " ");
}

function hasBadWord(value) {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return bannedWords.some((word) => normalized.includes(word.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

function showToast(title, text) {
  toastTitle.textContent = title;
  toastText.textContent = text;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getVisitorIpHash() {
  try {
    const response = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    const data = await response.json();

    return sha256(data.ip);
  } catch (error) {
    const storageKey = "emeline-device-id";
    let deviceId = localStorage.getItem(storageKey);

    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(storageKey, deviceId);
    }

    return sha256(deviceId);
  }
}

function renderRecentMessages(rows) {
  recentMessages.replaceChildren();

  rows.forEach((row) => {
    const item = document.createElement("article");
    const name = document.createElement("strong");
    const text = document.createElement("span");

    item.className = "recent-message";
    name.textContent = row.prenom;
    text.textContent = row.message;
    item.append(name, text);
    recentMessages.append(item);
  });
}

async function loadRecentMessages() {
  if (!db) {
    return;
  }

  const { data, error } = await db
    .from("messages")
    .select("prenom, message, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }

  renderRecentMessages(data);
}

async function isBanned(ipHash) {
  const { data, error } = await db.from("banned_ips").select("ip_hash").eq("ip_hash", ipHash).maybeSingle();

  if (error) {
    console.error(error);
    return false;
  }

  return Boolean(data);
}

async function loadSavedIdentity(ipHash) {
  const { data, error } = await db
    .from("messages")
    .select("prenom")
    .eq("ip_hash", ipHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (!data) {
    return;
  }

  savedIdentity = data;
  form.prenom.value = data.prenom;
  form.prenom.hidden = true;
  form.prenom.required = false;
  savedPerson.textContent = data.prenom;
  savedPerson.hidden = false;
}

async function initVisitor() {
  if (!db) {
    statusText.textContent = "Erreur Supabase";
    return;
  }

  statusText.textContent = "Chargement...";
  visitorIpHash = await getVisitorIpHash();

  if (await isBanned(visitorIpHash)) {
    form.querySelectorAll("input, textarea, button").forEach((element) => {
      element.disabled = true;
    });
    statusText.textContent = "Tu ne peux plus envoyer de message";
    return;
  }

  await loadSavedIdentity(visitorIpHash);
  await loadRecentMessages();
  statusText.textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!db) {
    statusText.textContent = "Erreur Supabase";
    return;
  }

  if (await isBanned(visitorIpHash)) {
    statusText.textContent = "Tu ne peux plus envoyer de message";
    return;
  }

  const submitButton = form.querySelector("button");
  submitButton.disabled = true;
  statusText.textContent = "Envoi...";

  const prenom = clean(savedIdentity?.prenom || form.prenom.value).toUpperCase();
  const payload = {
    nom: prenom,
    prenom,
    message: form.message.value.trim(),
    ip_hash: visitorIpHash,
  };

  if (hasBadWord(`${payload.prenom} ${payload.message}`)) {
    submitButton.disabled = false;
    statusText.textContent = "Message refuse";
    showToast("Message bloque", "Change ton message avant de l'envoyer.");
    return;
  }

  const { error } = await db.from("messages").insert(payload);

  submitButton.disabled = false;

  if (error) {
    statusText.textContent = "Erreur, reessaie";
    console.error(error);
    return;
  }

  savedIdentity = { prenom: payload.prenom };
  form.prenom.value = payload.prenom;
  form.prenom.hidden = true;
  form.prenom.required = false;
  savedPerson.textContent = payload.prenom;
  savedPerson.hidden = false;
  form.message.value = "";
  statusText.textContent = "";
  showToast("Message envoye", "Il va apparaitre sur l'ecran.");
  loadRecentMessages();
});

initVisitor();
setInterval(loadRecentMessages, 5000);
