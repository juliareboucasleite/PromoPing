import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config({ silent: true, debug: false, override: false, quiet: true });


// ===== EMAIL =====
export async function sendEmail(to, subject, message) {
  try {
    console.log(`Iniciando envio de email para: ${to}`);
    console.log(`Assunto: ${subject}`);
    
    // Verificar se as credenciais de email estão configuradas
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      const errorMsg = "Credenciais de email não configuradas (EMAIL_USER e EMAIL_PASS)";
      console.error(` [EMAIL] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`Credenciais encontradas: EMAIL_USER=${process.env.EMAIL_USER}`);
    console.log(`EMAIL_HOST: ${process.env.EMAIL_HOST || 'não configurado (usando serviço padrão)'}`);
    console.log(`EMAIL_PORT: ${process.env.EMAIL_PORT || 'não configurado (usando serviço padrão)'}`);

    // Configurar transporter - usar SMTP customizado se EMAIL_HOST estiver configurado
    let transporterConfig;
    
    if (process.env.EMAIL_HOST && process.env.EMAIL_PORT) {
      console.log(`Usando configuração SMTP customizada: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`);
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
        console.log(`STARTTLS habilitado para porta 587`);
      }
      
      if (isSecure) {
        console.log(`SSL habilitado para porta ${port}`);
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
      console.log(`Usando serviço pré-configurado: ${service} (detectado de ${emailDomain || 'não detectado'})`);
      
      transporterConfig = {
        service: service,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      };
    }

    console.log(`Criando transporter...`);
    const transporter = nodemailer.createTransport(transporterConfig);
    
    // Verificar conexão antes de enviar
    console.log(`Verificando conexão com servidor de email...`);
    await transporter.verify();
    console.log(` [EMAIL] Conexão com servidor de email verificada com sucesso`);

    // Detectar se a mensagem é HTML (contém tags HTML)
    const isHtml = /<[a-z][\s\S]*>/i.test(message);
    console.log(`Tipo de mensagem: ${isHtml ? 'HTML' : 'Texto'}`);

    console.log(`Enviando email...`);
    const info = await transporter.sendMail({
      from: `"PromoPing" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: isHtml ? message.replace(/<[^>]*>/g, '') : message, // Converter HTML para texto se necessário
      html: isHtml ? message : undefined, // Enviar como HTML se detectado
    });

    console.log(`Email enviado com sucesso!`);
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Enviado para: ${to} via ${process.env.EMAIL_HOST || 'serviço pré-configurado'}`);
    
    return info;
  } catch (err) {
    console.error(`Tipo: ${err.name}`);
    console.error(`Mensagem: ${err.message}`);
    console.error(`Código: ${err.code || 'N/A'}`);
    if (err.response) {
      console.error(`Resposta do servidor:`, err.response);
    }
    if (err.responseCode) {
      console.error(`Código de resposta: ${err.responseCode}`);
    }
    if (err.command) {
      console.error(`Comando: ${err.command}`);
    }
    console.error(`Stack trace:`);
    console.error(err.stack);
    throw err; // Re-lançar o erro para que o chamador possa tratá-lo
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
