// Script para configurar variáveis de ambiente
import fs from 'fs';
import path from 'path';

const envContent = `# Configuração da Base de Dados
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=pap
DB_PORT=3306

# JWT Secret
JWT_SECRET=promoping-super-secret-key-2024

# Google OAuth (precisa de ser configurado)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

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
  // Verificar se .env já existe
  if (fs.existsSync('.env')) {
    console.log('✅ Ficheiro .env já existe');
  } else {
    // Criar ficheiro .env
    fs.writeFileSync('.env', envContent);
    console.log('✅ Ficheiro .env criado com sucesso!');
  }
  
  console.log('\n📝 Configuração necessária:');
  console.log('1. Para Google OAuth, aceda a: https://console.developers.google.com/');
  console.log('2. Crie um projeto e ative a Google+ API');
  console.log('3. Configure as credenciais OAuth 2.0');
  console.log('4. Adicione http://localhost:3000/auth/google/callback como redirect URI');
  console.log('5. Copie o Client ID e Client Secret para o ficheiro .env');
  
  console.log('\n🔧 Para testar sem Google OAuth:');
  console.log('- Use o login normal com email/password');
  console.log('- Email: julia.admin@gmail.com');
  console.log('- Password: (a password que definiu)');
  
} catch (error) {
  console.error('❌ Erro ao criar ficheiro .env:', error);
}
