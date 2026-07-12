import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config({ silent: true, debug: false, override: false, quiet: true });

function htmlToPlainText(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function ensureHtmlDocument(html) {
  const trimmed = String(html || "").trim();
  if (/<!DOCTYPE/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }

  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;">
${trimmed}
</body>
</html>`;
}

function isHtmlContent(message) {
  return /<(?:!DOCTYPE|html|head|body|div|table|p|a|h[1-6]|style|meta|span|tr|td|th|ul|li|br|img)\b/i.test(message);
}

export async function sendEmail(to, subject, message, plainText) {
  try {
    console.log(`Iniciando envio de email para: ${to}`);
    console.log(`Assunto: ${subject}`);

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      const errorMsg = "Credenciais de email nao configuradas (EMAIL_USER e EMAIL_PASS)";
      console.error(` [EMAIL] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    let transporterConfig;

    if (process.env.EMAIL_HOST && process.env.EMAIL_PORT) {
      const port = parseInt(process.env.EMAIL_PORT, 10);
      const isSecure = port === 465 || process.env.EMAIL_SECURE === "true";

      transporterConfig = {
        host: process.env.EMAIL_HOST,
        port,
        secure: isSecure,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === "production",
        },
      };

      if (port === 587) {
        transporterConfig.requireTLS = true;
      }
    } else {
      const emailDomain = process.env.EMAIL_USER.split("@")[1]?.toLowerCase();
      const serviceMap = {
        "gmail.com": "gmail",
        "outlook.com": "outlook",
        "hotmail.com": "outlook",
        "live.com": "outlook",
        "yahoo.com": "yahoo",
      };

      transporterConfig = {
        service: serviceMap[emailDomain] || "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      };
    }

    const transporter = nodemailer.createTransport(transporterConfig);
    await transporter.verify();

    const isHtml = isHtmlContent(message);
    const mailOptions = {
      from: `"PromoPing" <${process.env.EMAIL_USER}>`,
      to,
      subject,
    };

    if (isHtml) {
      mailOptions.html = ensureHtmlDocument(message);
      mailOptions.text = plainText || htmlToPlainText(message);
    } else {
      mailOptions.text = plainText || message;
    }

    console.log(`Tipo de mensagem: ${isHtml ? "HTML" : "Texto"}`);
    const info = await transporter.sendMail(mailOptions);

    console.log(`Email enviado com sucesso! Message ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(` [EMAIL] Erro ao enviar email: ${err.message}`);
    throw err;
  }
}

export async function sendNotification({ canal, email, telefone, mensagem }) {
  if (canal === "email" && email) {
    await sendEmail(email, "PromoPing - Alerta de preco", mensagem);
  } else if (canal === "sms" && telefone) {
    await sendSMS(telefone, mensagem);
  } else {
    console.warn(" Canal nao suportado ou dados em falta:", canal);
  }
}
