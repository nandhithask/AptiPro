document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const tableBody = document.querySelector("#testHistoryTable tbody");
  const loadingDiv = document.querySelector("#loading");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  document.querySelector("#logoutButton").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
  });

  try {
    const response = await fetch("https://aptipro.onrender.com/api/test-history", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error("Failed to fetch history");

    const result = await response.json();
    const tests = result.tests || [];
 console.log('Fetched tests:', tests);
    loadingDiv.style.display = "none"; 


    if (tests.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4">No tests taken yet.</td></tr>`;
      return;
    }

   tableBody.innerHTML = '';

    tests.forEach(test => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${test.test_name}</td>
        <td>${test.topic}</td>
        <td>${test.score}%</td>
        <td>${test. avg_time}s</td>

        <td>${new Date(test.date_taken).toLocaleDateString()}</td>
      `;
      tableBody.appendChild(row);
    });

  } catch (error) {
    loadingDiv.textContent = "Error loading history. Please try again.";
    console.error("Error:", error);
  }
});