const dialog = document.querySelector("#time-dialog");
const form = document.querySelector("#time-form");
const timeInput = document.querySelector("#target-time");
const countdown = document.querySelector("#countdown");
const messages = document.querySelector("#messages");
const qrLink = document.querySelector("#qr-link");
const qrCode = document.querySelector("#qr-code");
const messageCount = document.querySelector("#message-count");
const pdfDownload = document.querySelector("#pdf-download");
const db = window.supabase?.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const parts = {
  days: document.querySelector("#days"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds"),
};

let timerId;
let confettiDone = false;
let pdfDone = false;
let pdfGenerating = false;
const shownMessageIds = new Set();
const activeBubbles = [];

function pad(value) {
  return String(value).padStart(2, "0");
}

function targetDateFromTime(timeValue) {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

function renderTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  parts.days.textContent = pad(days);
  parts.hours.textContent = pad(hours);
  parts.minutes.textContent = pad(minutes);
  parts.seconds.textContent = pad(seconds);
}

function startCountdown(target) {
  clearInterval(timerId);
  confettiDone = false;
  pdfDone = false;
  pdfDownload.hidden = true;
  countdown.hidden = false;

  function tick() {
    const remaining = target.getTime() - Date.now();
    renderTime(remaining);

    if (remaining <= 0) {
      clearInterval(timerId);
      renderTime(0);
      if (!confettiDone) {
        confettiDone = true;
        launchConfetti();
      }
      if (!pdfDone) {
        pdfDone = true;
        generateMessagesPdf();
      }
    }
  }

  tick();
  timerId = setInterval(tick, 250);
}

function messagePageUrl() {
  if (window.MESSAGE_PAGE_URL) {
    return window.MESSAGE_PAGE_URL;
  }

  return `${window.location.protocol}//${window.location.hostname}:30001/message.html`;
}

function setupQrCode() {
  const url = messagePageUrl();
  qrLink.href = url;
  qrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=10&data=${encodeURIComponent(url)}`;
}

function overlaps(first, second) {
  return !(
    first.right < second.left ||
    first.left > second.right ||
    first.bottom < second.top ||
    first.top > second.bottom
  );
}

function expandedRect(rect, padding) {
  return {
    left: rect.left - padding,
    right: rect.right + padding,
    top: rect.top - padding,
    bottom: rect.bottom + padding,
  };
}

function estimateBubbleSize(row) {
  const textLength = `${row.prenom || ""} : ${row.message || ""}`.length;
  const width = Math.min(window.innerWidth * 0.76, Math.max(240, Math.min(400, 150 + textLength * 5)));
  const height = textLength > 54 ? 92 : 66;

  return { width, height };
}

function candidateRect(position, size) {
  return {
    left: position.x - size.width / 2,
    right: position.x + size.width / 2,
    top: position.y - size.height / 2,
    bottom: position.y + size.height / 2,
  };
}

function blockedRects() {
  const rects = [expandedRect(qrLink.getBoundingClientRect(), 26)];

  if (!countdown.hidden) {
    rects.push(expandedRect(countdown.getBoundingClientRect(), 24));
  }

  return rects;
}

function findBubblePosition(row) {
  const size = estimateBubbleSize(row);
  const margin = 18;
  const minX = size.width / 2 + margin;
  const maxX = window.innerWidth - size.width / 2 - margin;
  const minY = size.height / 2 + margin;
  const maxY = window.innerHeight - size.height / 2 - margin;
  const blocked = blockedRects();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const position = {
      x: minX + Math.random() * Math.max(1, maxX - minX),
      y: minY + Math.random() * Math.max(1, maxY - minY),
    };
    const rect = candidateRect(position, size);
    const hitsBlockedArea = blocked.some((blockedRect) => overlaps(rect, blockedRect));
    const hitsBubble = activeBubbles.some((bubble) => overlaps(rect, bubble.rect));

    if (!hitsBlockedArea && !hitsBubble) {
      return {
        x: (position.x / window.innerWidth) * 100,
        y: (position.y / window.innerHeight) * 100,
        rect,
      };
    }
  }

  const fallbackPositions = [
    { x: 22, y: 18 },
    { x: 54, y: 18 },
    { x: 24, y: 43 },
    { x: 55, y: 43 },
    { x: 26, y: 66 },
  ];

  const fallback = fallbackPositions[activeBubbles.length % fallbackPositions.length];

  return {
    ...fallback,
    rect: candidateRect(
      { x: (fallback.x / 100) * window.innerWidth, y: (fallback.y / 100) * window.innerHeight },
      size
    ),
  };
}

function removeBubble(bubble) {
  const index = activeBubbles.findIndex((item) => item.element === bubble);

  if (index !== -1) {
    activeBubbles.splice(index, 1);
  }

  bubble.remove();
}

function hideBubble(bubble) {
  if (bubble.dataset.removing === "true") {
    return;
  }

  bubble.dataset.removing = "true";
  const index = activeBubbles.findIndex((item) => item.element === bubble);

  if (index !== -1) {
    activeBubbles.splice(index, 1);
  }

  bubble.classList.add("is-leaving");
  setTimeout(() => bubble.remove(), 500);
}

function addBubble(row) {
  if (shownMessageIds.has(row.id)) {
    return;
  }

  shownMessageIds.add(row.id);

  const bubble = document.createElement("div");
  const firstName = row.prenom || "";
  const { x, y, rect } = findBubblePosition(row);
  const drift = Math.random() > 0.5 ? 22 : -22;
  const duration = 5 + Math.random() * 4;
  const scale = 0.92 + Math.random() * 0.18;

  bubble.className = "message-bubble";
  bubble.textContent = `${firstName} : ${row.message || ""}`;
  bubble.dataset.messageId = row.id;
  bubble.dataset.ipHash = row.ip_hash || "";
  bubble.style.setProperty("--x", `${x}%`);
  bubble.style.setProperty("--y", `${y}%`);
  bubble.style.setProperty("--drift", `${drift}px`);
  bubble.style.setProperty("--duration", `${duration}s`);
  bubble.style.setProperty("--scale", scale.toFixed(2));
  messages.prepend(bubble);
  activeBubbles.unshift({ element: bubble, rect });

  setTimeout(() => {
    hideBubble(bubble);
  }, 25000);

  while (activeBubbles.length > 5) {
    const oldest = activeBubbles[activeBubbles.length - 1].element;
    hideBubble(oldest);
  }
}

async function banFromBubble(bubble) {
  if (!db || bubble.dataset.removing === "true") {
    return;
  }

  const messageId = bubble.dataset.messageId;
  const ipHash = bubble.dataset.ipHash;
  const shouldBan = window.confirm("Bannir cet utilisateur et supprimer ses messages ?");

  if (!shouldBan) {
    return;
  }

  if (ipHash) {
    const { error: banError } = await db.from("banned_ips").insert({ ip_hash: ipHash });

    if (banError && banError.code !== "23505") {
      window.alert("Erreur pendant le bannissement");
      console.error(banError);
      return;
    }

    const { error: deleteError } = await db.from("messages").delete().eq("ip_hash", ipHash);

    if (deleteError) {
      window.alert("Utilisateur banni, mais erreur pendant la suppression");
      console.error(deleteError);
      return;
    }

    [...messages.children].forEach((child) => {
      if (child.dataset.ipHash === ipHash) {
        hideBubble(child);
      }
    });
  } else if (messageId) {
    const { error } = await db.from("messages").delete().eq("id", messageId);

    if (error) {
      window.alert("Erreur pendant la suppression");
      console.error(error);
      return;
    }

    hideBubble(bubble);
  }

  updateMessageCount();
}

function launchConfetti() {
  const confetti = document.createElement("div");
  const colors = ["#ffd166", "#06d6a0", "#4cc9f0", "#ff6b6b", "#ffffff"];

  confetti.className = "confetti";

  for (let index = 0; index < 90; index += 1) {
    const piece = document.createElement("span");
    const x = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const duration = 2.4 + Math.random() * 1.8;
    const drift = -120 + Math.random() * 240;
    const rotate = 180 + Math.random() * 720;

    piece.style.setProperty("--x", `${x}vw`);
    piece.style.setProperty("--delay", `${delay}s`);
    piece.style.setProperty("--fall-duration", `${duration}s`);
    piece.style.setProperty("--fall-drift", `${drift}px`);
    piece.style.setProperty("--fall-rotate", `${rotate}deg`);
    piece.style.background = colors[index % colors.length];
    confetti.append(piece);
  }

  document.body.append(confetti);
  setTimeout(() => confetti.remove(), 5200);
}

async function fetchAllMessages() {
  const rows = [];
  const pageSize = 500;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await db
      .from("messages")
      .select("prenom, message, created_at")
      .order("created_at", { ascending: true })
      .range(start, start + pageSize - 1);

    if (error) {
      throw error;
    }

    rows.push(...data);

    if (data.length < pageSize) {
      return rows;
    }
  }
}

function addPdfHeader(pdf, pageNumber, totalMessages) {
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(9, 61, 69);
  pdf.rect(0, 0, pageWidth, 24, "F");
  pdf.setFillColor(255, 209, 102);
  pdf.rect(0, 24, pageWidth, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Les messages pour Emeline", 16, 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`${totalMessages} message${totalMessages > 1 ? "s" : ""} - Page ${pageNumber}`, pageWidth - 16, 15, {
    align: "right",
  });
}

function addPdfFooter(pdf) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setDrawColor(214, 232, 230);
  pdf.line(16, pageHeight - 16, pageWidth - 16, pageHeight - 16);
  pdf.setTextColor(83, 112, 113);
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.text("Un souvenir rempli de mots doux", pageWidth / 2, pageHeight - 10, { align: "center" });
}

function buildMessagesPdf(rows) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setFillColor(8, 72, 81);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFillColor(38, 157, 139);
  pdf.circle(pageWidth - 18, 32, 54, "F");
  pdf.setFillColor(255, 209, 102);
  pdf.circle(20, pageHeight - 18, 48, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(35);
  pdf.text("Joyeux anniversaire", pageWidth / 2, 104, { align: "center" });
  pdf.setFontSize(43);
  pdf.text("Emeline !", pageWidth / 2, 126, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(15);
  pdf.text("Tous les messages de ceux qui pensent a toi", pageWidth / 2, 146, { align: "center" });
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(57, 170, pageWidth - 114, 25, 5, 5, "F");
  pdf.setTextColor(8, 72, 81);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(`${rows.length} message${rows.length > 1 ? "s" : ""}`, pageWidth / 2, 186, { align: "center" });
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date()),
    pageWidth / 2,
    218,
    { align: "center" }
  );

  let pageNumber = 1;
  let y = pageHeight;

  rows.forEach((row, index) => {
    const firstName = row.prenom || "Anonyme";
    const messageLines = pdf.splitTextToSize(row.message || "", pageWidth - 48);
    const cardHeight = Math.max(30, 20 + messageLines.length * 5);

    if (y + cardHeight > pageHeight - 22) {
      if (pageNumber > 1) {
        addPdfFooter(pdf);
      }
      pdf.addPage();
      pageNumber += 1;
      addPdfHeader(pdf, pageNumber - 1, rows.length);
      y = 36;
    }

    const cardColor = index % 2 === 0 ? [237, 249, 247] : [242, 248, 252];
    pdf.setFillColor(...cardColor);
    pdf.setDrawColor(198, 225, 222);
    pdf.roundedRect(16, y, pageWidth - 32, cardHeight, 4, 4, "FD");
    pdf.setFillColor(255, 209, 102);
    pdf.circle(25, y + 10, 4, "F");
    pdf.setTextColor(8, 72, 81);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(firstName, 33, y + 11);
    pdf.setTextColor(42, 68, 70);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(messageLines, 24, y + 21);
    y += cardHeight + 6;
  });

  if (pageNumber > 1) {
    addPdfFooter(pdf);
  }

  return pdf;
}

async function generateMessagesPdf() {
  if (pdfGenerating) {
    return;
  }

  pdfGenerating = true;
  pdfDownload.hidden = false;
  pdfDownload.disabled = true;
  pdfDownload.classList.add("is-loading");
  pdfDownload.textContent = "Creation du PDF...";

  try {
    if (!db || !window.jspdf?.jsPDF) {
      throw new Error("Le generateur PDF n'est pas disponible");
    }

    const rows = await fetchAllMessages();
    const pdf = buildMessagesPdf(rows);
    pdf.save("messages-anniversaire-emeline.pdf");
    pdfDownload.textContent = "Telecharger a nouveau le PDF";
  } catch (error) {
    console.error(error);
    pdfDone = false;
    pdfDownload.textContent = "Reessayer de creer le PDF";
  } finally {
    pdfGenerating = false;
    pdfDownload.disabled = false;
    pdfDownload.classList.remove("is-loading");
  }
}

async function loadMessages() {
  if (!db) {
    return;
  }

  const { data, error } = await db
    .from("messages")
    .select("id, prenom, message, ip_hash, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }

  data.reverse().forEach(addBubble);
}

async function updateMessageCount() {
  if (!db) {
    return;
  }

  const { count, error } = await db.from("messages").select("id", { count: "exact", head: true });

  if (error) {
    console.error(error);
    return;
  }

  messageCount.textContent = `${count || 0} message${count > 1 ? "s" : ""}`;
}

form.addEventListener("submit", () => {
  startCountdown(targetDateFromTime(timeInput.value));
});

messages.addEventListener("click", (event) => {
  const bubble = event.target.closest(".message-bubble");

  if (bubble) {
    banFromBubble(bubble);
  }
});

pdfDownload.addEventListener("click", generateMessagesPdf);

window.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  timeInput.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  setupQrCode();
  loadMessages();
  updateMessageCount();
  setInterval(loadMessages, 5000);
  setInterval(updateMessageCount, 5000);
});
