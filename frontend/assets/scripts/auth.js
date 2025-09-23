    // assets/js/auth.js
    async function verificarSessao() {
        const token = localStorage.getItem("token");
        if (!token) {
          alert("Precisa estar logado!");
          return (window.location.href = "Login.html");
        }
      
        try {
          const res = await fetch("http://127.0.0.1:3000/api/auth/me", {
            headers: { Authorization: "Bearer " + token }
          });
          const data = await res.json();
      
          if (data.status === "ok") {
            console.log("Utilizador logado:", data.user);
            return data.user;
          } else {
            alert("Sessão inválida. Faça login novamente.");
            localStorage.removeItem("token");
            window.location.href = "Login.html";
          }
        } catch (err) {
          console.error("Erro ao verificar sessão:", err);
          alert("Erro de ligação com o servidor");
        }
      }
      
      function logout() {
        localStorage.removeItem("token");
        window.location.href = "Login.html";
      }
      