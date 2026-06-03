<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
/* ===============================
   SUPABASE CONFIG
================================ */
const SUPABASE_URL = "https://phmzaiwkfmqiqdcoysip.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobXphaXdrZm1xaXFkY295c2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjIwOTQsImV4cCI6MjA4NTQ5ODA5NH0.muAoaN5e41BiHyPKuYhhQTxbsQ0904iV8hylne-wHsw";

let supabase;

/* ===============================
   INIT AFTER PAGE LOAD
================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!window.supabase) {
    console.error("❌ Supabase SDK not loaded");
    return;
  }

  supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  loadApprovedComments();
});

/* ===============================
   SUBMIT COMMENT
================================ */
async function submitComment(event) {
  event.preventDefault();

  const name = document.getElementById("commentName").value.trim();
  const email = document.getElementById("commentEmail").value.trim();
  const message = document.getElementById("commentText").value.trim();
  const msgBox = document.getElementById("formMessage");
  const btn = event.target.querySelector("button");

  // Validation
  if (!name || !email || !message) {
    msgBox.innerText = "All fields are required.";
    msgBox.style.color = "red";
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msgBox.innerText = "Please enter a valid email address.";
    msgBox.style.color = "red";
    return;
  }

  btn.disabled = true;
  btn.innerText = "Submitting...";

  const { error } = await supabase
    .from("submissions")
    .insert([{
      type: "comment",
      name: name,
      email: email,
      message: message,
      status: "new",
      page_url: window.location.href,
      page_title: document.title
    }]);

  if (error) {
    console.error("❌ Supabase insert error:", error);
    msgBox.innerText = "Submission failed. Please try again.";
    msgBox.style.color = "red";
  } else {
    msgBox.innerText = "✅ Comment submitted successfully. Awaiting admin approval.";
    msgBox.style.color = "green";
    event.target.reset();
  }

  btn.disabled = false;
  btn.innerText = "Submit Comment";
}

/* ===============================
   LOAD APPROVED COMMENTS
================================ */
async function loadApprovedComments() {
  const list = document.getElementById("commentsList");
  if (!list) return;

  const { data, error } = await supabase
    .from("submissions")
    .select("name, message, created_at")
    .eq("type", "comment")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Fetch error:", error);
    list.innerHTML = "Unable to load comments.";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p>No comments yet. Be the first to comment.</p>";
    return;
  }

  list.innerHTML = data.map(c => `
    <div style="border-bottom:1px solid #eee; padding:15px 0;">
      <strong style="color:#ed2f39;">${escapeHTML(c.name)}</strong>
      <small style="color:#999; margin-left:10px;">
        ${new Date(c.created_at).toLocaleDateString()}
      </small>
      <p style="margin-top:8px; color:#444;">
        ${escapeHTML(c.message)}
      </p>
    </div>
  `).join("");
}

/* ===============================
   BASIC XSS PROTECTION
================================ */
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}
</script>
