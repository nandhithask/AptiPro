document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
    
    if (!user || !token) {
        window.location.href = 'login.html';
        return;
    }
    
    document.getElementById('usernameDisplay').textContent = user.username;

    document.querySelectorAll('.card-coming-soon').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            alert('This feature is coming soon!');
        });
    });

    
});


function toggleDropdown() {
    const dropdown = document.getElementById("dropdown");
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.clear();
    window.location.href = "login.html";
}

document.addEventListener("click", function(event) {
    const userIcon = document.querySelector(".user-icon");
    const dropdown = document.getElementById("dropdown");
    
    if (!userIcon.contains(event.target) && event.target !== userIcon) {
        dropdown.style.display = "none";
    }
});