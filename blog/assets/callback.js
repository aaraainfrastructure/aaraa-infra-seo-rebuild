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
   INIT AFTER DOM LOAD
================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!window.supabase) {
    console.error("Supabase SDK not loaded");
    return;
  }

  supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  const callbackForm = document.getElementById("callbackForm");
  const callbackMessage = document.getElementById("callbackMessage");

  if (!callbackForm) return;

  callbackForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(callbackForm);
    const name = formData.get("name")?.trim();
    const phone = formData.get("phone")?.trim();
    const email = formData.get("email")?.trim();
    const date = formData.get("date");
    const time = formData.get("time");

    // Validation
    if (!name || !phone || !email || !date || !time) {
      showMessage("All fields are required.", "red");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage("Please enter a valid email address.", "red");
      return;
    }

    const submitBtn = callbackForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.innerText = "Sending...";

    const { error } = await supabase.from("submissions").insert([{
      type: "callback",
      name,
      phone,
      email,
      preferred_date: date,
      preferred_time: time,
      message: `Callback requested for ${date} at ${time}`,
      status: "new",
      page_url: window.location.href,
      page_title: document.title
    }]);

    if (error) {
      console.error("Supabase error:", error);
      showMessage("Something went wrong. Please try again.", "red");
    } else {
      showMessage("✅ Request sent! We’ll call you back soon.", "green");
      callbackForm.reset();

      setTimeout(() => {
        if (typeof closeCallbackPopup === "function") {
          closeCallbackPopup();
        }
      }, 2000);
    }

    submitBtn.disabled = false;
    submitBtn.innerText = "Submit Request";
  });

  function showMessage(text, color) {
    callbackMessage.innerText = text;
    callbackMessage.style.color = color;
    callbackMessage.style.display = "block";
    callbackMessage.style.marginTop = "10px";
    callbackMessage.style.fontSize = "14px";
  }
});
</script>
