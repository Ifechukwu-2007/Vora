import { supabase } from "./supabase.js";

const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let currentUser = null;
let chatId = null;
let channel = null;

let isLoading = false;
let lastLoadedMessageTime = null;

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "login.html";
      return;
    }

    currentUser = session.user;

    const params = new URLSearchParams(window.location.search);
    chatId = params.get("chat_id");
    const serviceId = params.get("service_id");
    const requestId = params.get("request_id");

    if (!chatId) {
      alert("Chat ID is missing.");
      window.location.href = "my-messages.html";
      return;
    }

    setupLogout();
    await loadChatInfo(serviceId, requestId);
    await loadInitialMessages(); // optimized
    subscribeToMessages();
  } catch (error) {
    console.error("Init error:", error);
  }
});

// =========================
// LOAD CHAT INFO (FAST FIX)
// =========================
async function loadChatInfo(serviceId, requestId) {
  try {
    const { data } = await supabase
      .from("chats")
      .select("participants")
      .eq("id", chatId)
      .single();

    const otherUserId = Array.isArray(data.participants)
      ? data.participants.find(id => id !== currentUser.id)
      : data.participants;

    const { data: profile } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", otherUserId)
      .single();

    document.getElementById("other-user-name").textContent =
      profile?.full_name || "User";

    // Fetch service or request details
    let serviceTitle = "Direct Message";
    
    if (serviceId) {
      const { data: service } = await supabase
        .from("services")
        .select("title")
        .eq("id", serviceId)
        .maybeSingle();
      
      if (service?.title) {
        serviceTitle = service.title;
      }
    } else if (requestId) {
      const { data: request } = await supabase
        .from("requests")
        .select("title")
        .eq("id", requestId)
        .maybeSingle();
      
      if (request?.title) {
        serviceTitle = request.title;
      }
    }

    document.getElementById("service-title").textContent = serviceTitle;
  } catch (error) {
    console.error("Load Chat Info Error:", error);
    document.getElementById("service-title").textContent = "Chat";
    document.getElementById("other-user-name").textContent = "User";
  }
}

// =========================
// FAST INITIAL LOAD (LIMITED)
// =========================
async function loadInitialMessages() {
  isLoading = true;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(30); // ✅ SPEED FIX (IMPORTANT)

  isLoading = false;

  if (error) {
    console.error(error);
    return;
  }

  chatBox.innerHTML = "";

  if (!data.length) {
    chatBox.innerHTML = `<p class="text-gray-400 text-center">No messages yet</p>`;
    return;
  }

  data.forEach(renderMessage);

  lastLoadedMessageTime = data[data.length - 1].created_at;

  scrollBottom();
}

// =========================
// ESCAPE HTML (SECURITY)
// =========================
function escapeHTML(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =========================
// RENDER MESSAGE (FAST DOM INSERT)
// =========================
function renderMessage(message, append = true) {
  const isMine = message.sender_id === currentUser.id;

  const div = document.createElement("div");
  div.className = `flex ${isMine ? "justify-end" : "justify-start"} mb-2`;

  const timeStr = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  div.innerHTML = `
    <div class="max-w-xs px-3 py-2 rounded-2xl text-sm break-words
      ${isMine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}">
      ${escapeHTML(message.message)}
      <div class="text-[10px] opacity-60 mt-1">${timeStr}</div>
    </div>
  `;

  chatBox.appendChild(div);

  if (append) scrollBottom();
}

// =========================
// SEND MESSAGE (OPTIMIZED)
// =========================
sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  messageInput.value = "";

  const tempId = Date.now();

  // 🔥 instant UI (NO WAITING FOR DB)
  renderMessage({
    sender_id: currentUser.id,
    message: text,
    created_at: new Date().toISOString()
  });

  try {
    const { error } = await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: currentUser.id,
      message: text
    });

    if (error) throw error;
  } catch (error) {
    console.error(error);
    alert("Failed to send message");
  }
}

// =========================
// REALTIME (FAST + CLEAN)
// =========================
function subscribeToMessages() {
  if (channel) supabase.removeChannel(channel);

  channel = supabase
    .channel(`chat-${chatId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`
      },
      payload => {
        // prevent duplicate render (important optimization)
        if (payload.new.sender_id === currentUser.id) return;

        renderMessage(payload.new);
      }
    )
    .subscribe();
}

// =========================
// LOGOUT
// =========================
function setupLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}

// =========================
// SCROLL
// =========================
function scrollBottom() {
  requestAnimationFrame(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}