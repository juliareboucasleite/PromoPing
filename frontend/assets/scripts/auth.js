// ================== TOKEN ==================
export function salvarToken(token) {
  localStorage.setItem("token", token);
}

export function obterToken() {
  return localStorage.getItem("token");
}

export function removerToken() {
  localStorage.removeItem("token");
}

// ================== VERIFICAR SESSÃO ==================
export async function verificarSessao() {
  const token = obterToken();
  if (!token) {
    alert("Precisa estar logado!");
    window.location.href = "/inc/Login.html";
    return null;
  }

  try {
    const res = await makeRequest("http://127.0.0.1:3000/api/user/me", {
      headers: { Authorization: "Bearer " + token },
    });

    const data = await res.json();

    if (data.status === "ok") {
      console.log("Utilizador logado:", data.user);
      return data.user;
    } else {
      alert("Sessão inválida. Faça login novamente.");
      removerToken();
      window.location.href = "/inc/Login.html";
      return null;
    }
  } catch (err) {
    console.error("Erro ao verificar sessão:", err);
    alert("Erro de ligação com o servidor");
    return null;
  }
}

// ================== LOGIN COM EMAIL ==================
export async function loginEmail(email, password) {
  try {
    const res = await makeRequest("http://127.0.0.1:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.status === "ok" && data.token) {
      salvarToken(data.token);
      window.location.href = "Painel.html";
    } else {
      alert(data.error || "Erro ao entrar.");
    }
  } catch (err) {
    console.error("Erro no login:", err);
    alert("Erro interno no servidor.");
  }
}

// ================== REGISTO COM EMAIL ==================
export async function register(nome, email, password) {
  try {
    const res = await makeRequest("http://127.0.0.1:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, password }),
    });

    const data = await res.json();

    if (data.status === "ok") {
      alert("Conta criada com sucesso! Verifique seu email.");
      window.location.href = "/inc/Login.html";
    } else {
      alert(data.error || "Erro no registo.");
    }
  } catch (err) {
    console.error("Erro no registo:", err);
    alert("Erro interno no servidor.");
  }
}

// ================== LOGOUT ==================
export function logout() {
  removerToken();
  window.location.href = "Login.html";
}
