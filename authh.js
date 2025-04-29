const modal = document.getElementById("forgotPasswordModal");
  const forgotLink = document.getElementById("forgotPasswordLink");
  const closeModal = document.querySelector(".close-modal");


document.addEventListener("DOMContentLoaded", () => {
      document.querySelector("#loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();
    const username = document.querySelector("#username").value;
    const password = document.querySelector("#password").value;

    try {
      const response = await fetch("https://aptipro.onrender.com/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({username, password}),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        const userData = {
          id: data.user.id,
          userId: data.user.id,
          username: data.user.username,
          email: data.user.email
        };
        localStorage.setItem('user', JSON.stringify(userData));
        window.location.href = 'dashboard.html';
      } else {
        alert(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error("Login error:", error);
      alert('An error occurred during login. Please try again.');
    }
  });


  

  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    modal.style.display = "block";
  });

  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

 
  document.querySelector("#forgotPasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.querySelector("#resetEmail").value;
    const messageEl = document.getElementById("resetMessage");
    
    try {
      const response = await fetch("https://aptipro.onrender.com/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        messageEl.textContent = data.message;
        messageEl.className = "message success";
        document.querySelector("#forgotPasswordForm").reset();
      } else {
        messageEl.textContent = data.message || "Error sending reset link";
        messageEl.className = "message error";
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      messageEl.textContent = "An error occurred. Please try again.";
      messageEl.className = "message error";
    }
  });

  const redirectFrom = sessionStorage.getItem('redirectFrom');
  if (redirectFrom && loginForm) {
    const messageEl = document.createElement('div');
    messageEl.className = 'login-message';
    messageEl.innerHTML = '<i class="fas fa-info-circle"></i> Please log in to continue';
    loginForm.prepend(messageEl);
    sessionStorage.removeItem('redirectFrom');
  }
});


window.addEventListener('load', () => {
  setTimeout(() => {
    const spans = document.querySelectorAll('.animated-background span');
    spans.forEach(span => {
      const randomLeft = Math.floor(Math.random() * 100);
      const randomSize = Math.floor(Math.random() * 80) + 10;
      const randomDelay = Math.floor(Math.random() * 20);
      const randomDuration = Math.floor(Math.random() * 20) + 10;
      
      span.style.left = `${randomLeft}%`;
      span.style.width = `${randomSize}px`;
      span.style.height = `${randomSize}px`;
      span.style.animationDelay = `${randomDelay}s`;
      span.style.animationDuration = `${randomDuration}s`;
    });
  }, 100);
}, { passive: true });
