import nodemailer from "nodemailer";
import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config({ silent: true, debug: false, override: false, quiet: true });


// ===== EMAIL =====
export async function sendEmail(to, subject, message) {
  try {
    console.log(`📧 [EMAIL] Iniciando envio de email para: ${to}`);
    console.log(`📧 [EMAIL] Assunto: ${subject}`);
    
    // Verificar se as credenciais de email estão configuradas
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      const errorMsg = "Credenciais de email não configuradas (EMAIL_USER e EMAIL_PASS)";
      console.error(`❌ [EMAIL] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`📧 [EMAIL] Credenciais encontradas: EMAIL_USER=${process.env.EMAIL_USER}`);
    console.log(`📧 [EMAIL] EMAIL_HOST: ${process.env.EMAIL_HOST || 'não configurado (usando serviço padrão)'}`);
    console.log(`📧 [EMAIL] EMAIL_PORT: ${process.env.EMAIL_PORT || 'não configurado (usando serviço padrão)'}`);

    // Configurar transporter - usar SMTP customizado se EMAIL_HOST estiver configurado
    let transporterConfig;
    
    if (process.env.EMAIL_HOST && process.env.EMAIL_PORT) {
      console.log(`📧 [EMAIL] Usando configuração SMTP customizada: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`);
      // Usar configuração SMTP customizada
      const port = parseInt(process.env.EMAIL_PORT, 10);
      const isSecure = port === 465 || process.env.EMAIL_SECURE === 'true';
      
      transporterConfig = {
        host: process.env.EMAIL_HOST,
        port: port,
        secure: isSecure, // SSL para porta 465
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        // Configurações adicionais para melhor compatibilidade
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production', // Em produção, verificar certificado
        },
      };
      
      // Se não for SSL (porta 465), usar STARTTLS
      if (port === 587) {
        transporterConfig.requireTLS = true;
        console.log(`📧 [EMAIL] STARTTLS habilitado para porta 587`);
      }
      
      if (isSecure) {
        console.log(`📧 [EMAIL] SSL habilitado para porta ${port}`);
      }
    } else {
      // Usar serviço pré-configurado (Gmail, Outlook, etc.)
      const emailDomain = process.env.EMAIL_USER.split('@')[1]?.toLowerCase();
      const serviceMap = {
        'gmail.com': 'gmail',
        'outlook.com': 'outlook',
        'hotmail.com': 'outlook',
        'live.com': 'outlook',
        'yahoo.com': 'yahoo',
      };
      
      const service = serviceMap[emailDomain] || 'gmail';
      console.log(`📧 [EMAIL] Usando serviço pré-configurado: ${service} (detectado de ${emailDomain || 'não detectado'})`);
      
      transporterConfig = {
        service: service,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      };
    }

    console.log(`📧 [EMAIL] Criando transporter...`);
    const transporter = nodemailer.createTransport(transporterConfig);
    
    // Verificar conexão antes de enviar
    console.log(`📧 [EMAIL] Verificando conexão com servidor de email...`);
    await transporter.verify();
    console.log(`✅ [EMAIL] Conexão com servidor de email verificada com sucesso`);

    // Detectar se a mensagem é HTML (contém tags HTML)
    const isHtml = /<[a-z][\s\S]*>/i.test(message);
    console.log(`📧 [EMAIL] Tipo de mensagem: ${isHtml ? 'HTML' : 'Texto'}`);

    console.log(`📧 [EMAIL] Enviando email...`);
    const info = await transporter.sendMail({
      from: `"PromoPing" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: isHtml ? message.replace(/<[^>]*>/g, '') : message, // Converter HTML para texto se necessário
      html: isHtml ? message : undefined, // Enviar como HTML se detectado
    });

    console.log(`✅ [EMAIL] Email enviado com sucesso!`);
    console.log(`✅ [EMAIL] Message ID: ${info.messageId}`);
    console.log(`✅ [EMAIL] Enviado para: ${to} via ${process.env.EMAIL_HOST || 'serviço pré-configurado'}`);
    
    return info;
  } catch (err) {
    console.error(`❌ [EMAIL] ========== ERRO DETALHADO ==========`);
    console.error(`❌ [EMAIL] Tipo: ${err.name}`);
    console.error(`❌ [EMAIL] Mensagem: ${err.message}`);
    console.error(`❌ [EMAIL] Código: ${err.code || 'N/A'}`);
    if (err.response) {
      console.error(`❌ [EMAIL] Resposta do servidor:`, err.response);
    }
    if (err.responseCode) {
      console.error(`❌ [EMAIL] Código de resposta: ${err.responseCode}`);
    }
    if (err.command) {
      console.error(`❌ [EMAIL] Comando: ${err.command}`);
    }
    console.error(`❌ [EMAIL] Stack trace:`);
    console.error(err.stack);
    console.error(`❌ [EMAIL] ===================================`);
    throw err; // Re-lançar o erro para que o chamador possa tratá-lo
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

    console.log(` SMS enviado para ${to}`);
  } catch (err) {
    console.error(" Erro ao enviar SMS:", err.message);
  }
}

// ===== ESCOLHER CANAL =====
export async function sendNotification({ canal, email, telefone, mensagem }) {
  if (canal === "email" && email) {
    await sendEmail(email, "PromoPing - Alerta de preço", mensagem);
  } else if (canal === "sms" && telefone) {
    await sendSMS(telefone, mensagem);
  } else {
    console.warn(" Canal não suportado ou dados em falta:", canal);
  }
}
