export function salvarToken(token) {
  localStorage.setItem("token", token);
}

export function obterToken() {
  return localStorage.getItem("token");
}

export function removerToken() {
  localStorage.removeItem("token");
}

export async function verificarSessao() {
  const token = obterToken();
  if (!token) {
    alert("You need to be signed in!");
    window.location.href = "/login";
    return null;
  }

  try {
    const res = await makeRequest("/api/user/me", {
      headers: { Authorization: "Bearer " + token },
    });

    const data = await res.json();

    if (data.status === "ok") {
      console.log("Signed-in user:", data.user);
      return data.user;
    } else {
      alert("Invalid session. Please sign in again.");
      removerToken();
      window.location.href = "/login";
      return null;
    }
  } catch (err) {
    console.error("Error checking session:", err);
    alert("Server connection error");
    return null;
  }
}

export async function loginEmail(email, password) {
  try {
    const res = await makeRequest("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.status === "ok" && data.token) {
      salvarToken(data.token);
      // Salvar informação de reativação se a conta foi reativada
      if (data.accountReactivated) {
        localStorage.setItem("accountReactivated", "true");
      }
      window.location.href = "/dashboard";
    } else {
      alert(data.error || "Sign-in error.");
    }
  } catch (err) {
    console.error("Sign-in error:", err);
    alert("Internal server error.");
  }
}

export async function register(nome, email, password) {
  try {
    const res = await makeRequest("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, password }),
    });

    const data = await res.json();

    if (data.status === "ok") {
      alert("Account created successfully! Check your email.");
      window.location.href = "/login";
    } else {
      alert(data.error || "Registration error.");
    }
  } catch (err) {
    console.error("Registration error:", err);
    alert("Internal server error.");
  }
}

export function logout() {
  removerToken();
  window.location.href = "/login";
}
