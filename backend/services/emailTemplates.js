const BRAND = {
  orange: "#f4af55",
  orangeDeep: "#dc7c35",
  cream: "#fff8ee",
  ink: "#0e0f19",
  inkSoft: "#2d1b69",
  mute: "#5b5b5b",
  line: "#ececec",
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell({ preheader, bodyHtml, footerHtml }) {
  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>PromoPing</title>
</head>
<body style="margin:0;padding:0;background-color:#f6efe4;font-family:'Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:${BRAND.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,#f4af55 0%,#ed9a6c 45%,#dc7c35 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.7);box-shadow:0 16px 40px rgba(14,15,25,0.12);">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,${BRAND.orange} 0%,${BRAND.orangeDeep} 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 40px 12px;text-align:center;">
              <img src="https://promoping.pt/assets/images/PromoPing.png" width="52" height="52" alt="PromoPing" style="display:block;margin:0 auto 18px;border-radius:12px;">
            </td>
          </tr>
          ${bodyHtml}
          ${footerHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function defaultFooter({ userEmail, baseUrl, notification = false }) {
  const safeEmail = escapeHtml(userEmail);
  const safeBase = escapeHtml(String(baseUrl || "https://promoping.pt").replace(/\/$/, ""));

  const introLine = notification || !safeEmail
    ? `<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:${BRAND.mute};text-align:center;">Esta &eacute; uma notifica&ccedil;&atilde;o autom&aacute;tica do PromoPing.</p>`
    : `<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:${BRAND.mute};text-align:center;">Este email foi enviado para <strong style="color:${BRAND.ink};">${safeEmail}</strong></p>`;

  return `<tr>
    <td style="padding:28px 40px 34px;background-color:${BRAND.cream};border-top:1px solid ${BRAND.line};">
      ${introLine}
      <p style="margin:0 0 16px;font-size:12px;line-height:1.8;color:${BRAND.mute};text-align:center;">
        <a href="${safeBase}/docs/support" style="color:${BRAND.inkSoft};text-decoration:none;">Centro de Ajuda</a>
        &nbsp;&middot;&nbsp;
        <a href="${safeBase}/docs/privacy-policy" style="color:${BRAND.inkSoft};text-decoration:none;">Privacidade</a>
        &nbsp;&middot;&nbsp;
        <a href="${safeBase}/docs/terms-of-service" style="color:${BRAND.inkSoft};text-decoration:none;">Termos</a>
      </p>
      <p style="margin:0;font-size:11px;line-height:1.5;color:#8a8a8a;text-align:center;">
        PromoPing &mdash; monitoriza&ccedil;&atilde;o de pre&ccedil;os online<br>
        &copy; ${new Date().getFullYear()} PromoPing. Todos os direitos reservados.
      </p>
    </td>
  </tr>`;
}

export function buildPasswordResetEmail({ resetUrl, userEmail, baseUrl }) {
  const safeUrl = escapeHtml(resetUrl);
  const preheader = "Recebemos o teu pedido para repor a palavra-passe da tua conta PromoPing.";

  const bodyHtml = `<tr>
    <td style="padding:0 40px 8px;text-align:center;">
      <h1 style="margin:0 0 10px;font-size:24px;line-height:1.25;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;">Recebemos o teu pedido</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.mute};">J&aacute; podes repor a tua palavra-passe com seguran&ccedil;a.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 40px 8px;text-align:center;">
      <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.orange} 0%,${BRAND.orangeDeep} 100%);color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:999px;font-size:15px;font-weight:700;box-shadow:0 10px 24px rgba(220,124,53,0.28);">Redefinir palavra-passe</a>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 40px 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.cream};border:1px solid #ffe2c8;border-radius:16px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${BRAND.ink};"><strong>Importante:</strong> este link expira em <strong>24 horas</strong>.</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.mute};">Se o bot&atilde;o n&atilde;o funcionar, copia e cola este endere&ccedil;o no browser:</p>
            <p style="margin:10px 0 0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:${BRAND.orangeDeep};text-decoration:underline;">${safeUrl}</a></p>
          </td>
        </tr>
      </table>
      <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:${BRAND.mute};text-align:center;">N&atilde;o solicitaste uma nova palavra-passe? Podes ignorar este email em seguran&ccedil;a.</p>
    </td>
  </tr>`;

  return {
    subject: "Rep\u00f5e a palavra-passe \u2014 PromoPing",
    html: emailShell({
      preheader,
      bodyHtml,
      footerHtml: defaultFooter({ userEmail, baseUrl }),
    }),
    text: [
      "Recebemos o teu pedido para repor a palavra-passe PromoPing.",
      "",
      "Redefine a tua palavra-passe aqui:",
      resetUrl,
      "",
      "Este link expira em 24 horas.",
      "Se nao solicitaste este pedido, podes ignorar este email.",
    ].join("\n"),
  };
}

function formatStoreName(value) {
  const name = String(value || "").trim();
  return name && name.toLowerCase() !== "null" ? name : "Loja online";
}

export function buildPriceChangeEmail({
  productName,
  storeName,
  previousPrice,
  currentPrice,
  changeLabel,
  changePercent,
  productUrl,
  isIncrease,
  userName = "Utilizador",
  updatedBySupport = false,
}) {
  const safeName = escapeHtml(productName);
  const safeStore = escapeHtml(formatStoreName(storeName));
  const safeUrl = escapeHtml(productUrl || "https://promoping.pt");
  const safeUser = escapeHtml(userName);
  const accent = isIncrease ? "#c0392b" : "#2d8659";
  const title = isIncrease ? "Preco subiu" : "Preco desceu";
  const hint = isIncrease
    ? "O preco subiu - considera aguardar uma promocao."
    : "O preco desceu - pode ser uma boa oportunidade!";
  const intro = updatedBySupport
    ? `Ola ${safeUser}, a nossa equipa de suporte atualizou o preco do produto que monitorizas.`
    : `Ola ${safeUser}, houve uma alteracao no produto que estás a monitorizar.`;

  const bodyHtml = `<tr>
    <td style="padding:0 40px 8px;text-align:center;">
      <h1 style="margin:0 0 10px;font-size:24px;line-height:1.25;font-weight:700;color:${BRAND.ink};">${title}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.mute};">${intro}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};border:1px solid #ffe2c8;border-radius:16px;">
        <tr>
          <td style="padding:20px 22px;font-size:14px;line-height:1.7;color:${BRAND.ink};">
            <p style="margin:0 0 8px;"><strong>Produto:</strong> ${safeName}</p>
            <p style="margin:0 0 8px;"><strong>Loja:</strong> ${safeStore}</p>
            <p style="margin:0 0 8px;"><strong>Preco anterior:</strong> ${escapeHtml(previousPrice)}</p>
            <p style="margin:0 0 8px;"><strong>Preco atual:</strong> <span style="color:${accent};font-weight:700;">${escapeHtml(currentPrice)}</span></p>
            <p style="margin:0;"><strong>Mudanca:</strong> ${escapeHtml(changeLabel)} (${escapeHtml(changePercent)})</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 40px 8px;text-align:center;">
      <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.orange} 0%,${BRAND.orangeDeep} 100%);color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:999px;font-size:15px;font-weight:700;">Ver produto</a>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 40px 28px;text-align:center;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.mute};">${hint}</p>
    </td>
  </tr>`;

  return {
    subject: `${isIncrease ? "Preco subiu" : "Preco desceu"}: ${productName}`,
    html: emailShell({
      preheader: `${title} - ${productName}`,
      bodyHtml,
      footerHtml: defaultFooter({ userEmail: "", baseUrl: "https://promoping.pt", notification: true }),
    }),
    text: [
      title,
      "",
      `Produto: ${productName}`,
      `Loja: ${formatStoreName(storeName)}`,
      `Preco anterior: ${previousPrice}`,
      `Preco atual: ${currentPrice}`,
      `Mudanca: ${changeLabel} (${changePercent})`,
      "",
      `Ver produto: ${productUrl || "https://promoping.pt"}`,
      "",
      hint,
    ].join("\n"),
  };
}

export function buildTargetPriceEmail({
  productName,
  storeName,
  targetPrice,
  currentPrice,
  savingsLabel,
  savingsPercent,
  productUrl,
  userName = "Utilizador",
  updatedBySupport = false,
}) {
  const safeName = escapeHtml(productName);
  const safeStore = escapeHtml(formatStoreName(storeName));
  const safeUrl = escapeHtml(productUrl || "https://promoping.pt");
  const safeUser = escapeHtml(userName);
  const intro = updatedBySupport
    ? `Ola ${safeUser}, a nossa equipa de suporte confirmou que o produto que monitorizas chegou ao preco definido.`
    : `Ola ${safeUser}, o produto que monitorizas chegou ao preco definido.`;

  const bodyHtml = `<tr>
    <td style="padding:0 40px 8px;text-align:center;">
      <h1 style="margin:0 0 10px;font-size:24px;line-height:1.25;font-weight:700;color:${BRAND.ink};">Preco alvo atingido</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.mute};">${intro}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};border:1px solid #ffe2c8;border-radius:16px;">
        <tr>
          <td style="padding:20px 22px;font-size:14px;line-height:1.7;color:${BRAND.ink};">
            <p style="margin:0 0 8px;"><strong>Produto:</strong> ${safeName}</p>
            <p style="margin:0 0 8px;"><strong>Loja:</strong> ${safeStore}</p>
            <p style="margin:0 0 8px;"><strong>Preco alvo:</strong> ${escapeHtml(targetPrice)}</p>
            <p style="margin:0 0 8px;"><strong>Preco atual:</strong> <span style="color:#2d8659;font-weight:700;">${escapeHtml(currentPrice)}</span></p>
            <p style="margin:0;"><strong>Poupanca:</strong> ${escapeHtml(savingsLabel)} (${escapeHtml(savingsPercent)})</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 40px 28px;text-align:center;">
      <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.orange} 0%,${BRAND.orangeDeep} 100%);color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:999px;font-size:15px;font-weight:700;">Ver produto agora</a>
    </td>
  </tr>`;

  return {
    subject: `Preco alvo atingido: ${productName}`,
    html: emailShell({
      preheader: `Preco alvo atingido - ${productName}`,
      bodyHtml,
      footerHtml: defaultFooter({ userEmail: "", baseUrl: "https://promoping.pt", notification: true }),
    }),
    text: [
      "Preco alvo atingido",
      "",
      `Produto: ${productName}`,
      `Loja: ${formatStoreName(storeName)}`,
      `Preco alvo: ${targetPrice}`,
      `Preco atual: ${currentPrice}`,
      `Poupanca: ${savingsLabel} (${savingsPercent})`,
      "",
      `Ver produto: ${productUrl || "https://promoping.pt"}`,
    ].join("\n"),
  };
}
