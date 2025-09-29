import nodemailer from "nodemailer";
import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();


// ===== EMAIL =====
export async function sendEmail(to, subject, message) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail", // podes trocar por "outlook" ou SMTP custom
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"PromoPing" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: message,
    });

    console.log(`📧 Email enviado para ${to}`);
  } catch (err) {
    console.error("❌ Erro ao enviar email:", err.message);
  }
}

// ===== SMS =====
export async function sendSMS(to, message) {
  try {
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE, // número fornecido pela Twilio
      to, // número destino (+351... ou +55...)
    });

    console.log(`📱 SMS enviado para ${to}`);
  } catch (err) {
    console.error("❌ Erro ao enviar SMS:", err.message);
  }
}

// ===== ESCOLHER CANAL =====
export async function sendNotification({ canal, email, telefone, mensagem }) {
  if (canal === "email" && email) {
    await sendEmail(email, "PromoPing - Alerta de preço", mensagem);
  } else if (canal === "sms" && telefone) {
    await sendSMS(telefone, mensagem);
  } else {
    console.warn("⚠️ Canal não suportado ou dados em falta:", canal);
  }
}
