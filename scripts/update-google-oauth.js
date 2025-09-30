// Script para atualizar as credenciais do Google OAuth
import fs from 'fs';

const envContent = `# Configuração da Base de Dados
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=pap
DB_PORT=3306

# JWT Secret
JWT_SECRET=promoping-super-secret-key-2024

# Google OAuth - Credenciais configuradas
GOOGLE_CLIENT_ID=928179391463-kkjun7plqvf61la74t0c975gjaleu51g.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-uUib

# Twilio SMS (opcional)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
`;

try {
  // Criar/atualizar ficheiro .env
  fs.writeFileSync('.env', envContent);
  console.log('✅ Ficheiro .env atualizado com as credenciais do Google OAuth!');
  
  console.log('\n🔧 Próximos passos:');
  console.log('1. Reinicie o servidor para aplicar as mudanças');
  console.log('2. Teste o login com Google em: http://127.0.0.1:3000/pages/Login.html');
  console.log('3. Ou use o login normal com: julia.admin@gmail.com');
  
} catch (error) {
  console.error('❌ Erro ao atualizar ficheiro .env:', error);
}
