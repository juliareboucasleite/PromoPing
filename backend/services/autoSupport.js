/**
 * Serviço de Respostas Automáticas de Suporte
 * 
 * Analisa mensagens de suporte e fornece respostas automáticas baseadas em categorias
 */

import { pool } from "../database/db.js";

/**
 * Categorias de problemas e suas palavras-chave
 */
const CATEGORIES = {
    login: {
        keywords: ['login', 'entrar', 'logar', 'acessar', 'senha', 'password', 'conta', 'autenticação', 'autenticacao', 'erro ao entrar', 'não consigo entrar', 'nao consigo entrar', 'esqueci a senha', 'recuperar senha'],
        responses: [
            {
                condition: (msg) => msg.toLowerCase().includes('esqueci') || msg.toLowerCase().includes('esquec'),
                response: `Olá! Vejo que está com problemas para acessar sua conta. Aqui estão algumas dicas para recuperar sua senha:

1. Recuperação de Senha:
   - Acesse a página de login e clique em "Esqueci minha senha"
   - Digite o email cadastrado na sua conta
   - Verifique sua caixa de entrada (e spam) para o email de recuperação
   - O link de recuperação é válido por 1 hora

2. Verifique seu Email:
   - Certifique-se de usar o mesmo email cadastrado
   - Verifique a pasta de spam/lixo eletrônico
   - Aguarde alguns minutos, o email pode demorar a chegar

3. Ainda com problemas?
   - Verifique se digitou o email corretamente
   - Tente novamente após alguns minutos
   - Se o problema persistir, nossa equipe de suporte entrará em contato em breve!`
            },
            {
                condition: (msg) => msg.toLowerCase().includes('erro') || msg.toLowerCase().includes('não funciona') || msg.toLowerCase().includes('nao funciona'),
                response: `Olá! Vejo que está tendo problemas para fazer login. Aqui estão algumas soluções comuns:

1. Verifique suas Credenciais:
   - Confirme que está usando o email correto
   - Verifique se a senha está correta (maiúsculas/minúsculas importam)
   - Tente copiar e colar a senha para evitar erros de digitação

2. Limpe o Cache do Navegador:
   - Pressione Ctrl+Shift+Delete (Windows) ou Cmd+Shift+Delete (Mac)
   - Selecione "Cookies e dados de sites"
   - Clique em "Limpar dados"
   - Tente fazer login novamente

3. Tente em Modo Anônimo:
   - Abra uma janela anônima/privada
   - Acesse o site e tente fazer login
   - Isso ajuda a identificar problemas com cache ou extensões

4. Verifique sua Conexão:
   - Certifique-se de que está conectado à internet
   - Tente recarregar a página (F5 ou Ctrl+R)

Se nenhuma dessas soluções funcionar, nossa equipe de suporte entrará em contato para ajudá-lo!`
            },
            {
                condition: () => true, // Default para login
                response: `Olá! Vejo que está com dúvidas sobre login. Aqui estão algumas informações úteis:

Como fazer login:
1. Acesse a página de login
2. Digite seu email cadastrado
3. Digite sua senha
4. Clique em "Entrar"

Problemas comuns:
- Esqueci minha senha: Use a opção "Recuperar senha" na página de login
- Email não verificado: Verifique sua caixa de entrada e confirme seu email
- Conta bloqueada: Entre em contato conosco para desbloquear

Se precisar de mais ajuda, nossa equipe de suporte entrará em contato!`
            }
        ]
    },
    produtos: {
        keywords: ['produto', 'produtos', 'monitorar', 'monitorização', 'preço', 'preco', 'alerta', 'notificação', 'notificacao', 'adicionar produto', 'remover produto'],
        responses: [
            {
                condition: () => true,
                response: `Olá! Vejo que tem dúvidas sobre produtos. Aqui estão algumas informações:

Adicionar Produto:
1. Acesse a página de produtos no seu dashboard
2. Clique em "Adicionar Produto"
3. Cole o link do produto que deseja monitorar
4. Defina o preço alvo desejado
5. Salve o produto

Monitorização:
- Os produtos são verificados automaticamente conforme seu plano
- Você receberá notificações quando o preço atingir seu alvo
- O histórico de preços fica disponível na página do produto

Limites de Produtos:
- Plano Free: até 5 produtos
- Plano Basic: até 25 produtos
- Plano Premium: até 50 produtos

Se precisar de mais ajuda, nossa equipe de suporte entrará em contato!`
            }
        ]
    },
    pagamento: {
        keywords: ['pagamento', 'plano', 'planos', 'assinatura', 'subscription', 'cartão', 'cartao', 'cartão de crédito', 'cartao de credito', 'stripe', 'preço', 'preco', 'cobrança', 'cobranca'],
        responses: [
            {
                condition: () => true,
                response: `Olá! Vejo que tem dúvidas sobre pagamentos e planos. Aqui estão algumas informações:

Nossos Planos:
- Free: Grátis - até 5 produtos, histórico de 7 dias
- Basic: €4,99/mês - até 25 produtos, histórico de 30 dias
- Premium: €15,30/mês - até 50 produtos, histórico de 50 dias

Formas de Pagamento:
- Aceitamos cartões de crédito/débito através do Stripe
- Pagamento seguro e criptografado
- Renovação automática mensal

Gerenciar Assinatura:
- Acesse seu perfil no dashboard
- Vá em "Configurações" > "Plano"
- Você pode atualizar, cancelar ou alterar seu plano a qualquer momento

Se precisar de mais ajuda com pagamentos, nossa equipe de suporte entrará em contato!`
            }
        ]
    },
    notificacoes: {
        keywords: ['notificação', 'notificacao', 'email', 'discord', 'sms', 'alerta', 'não recebo', 'nao recebo', 'receber alerta'],
        responses: [
            {
                condition: () => true,
                response: `Olá! Vejo que tem dúvidas sobre notificações. Aqui estão algumas informações:

Canais de Notificação:
- Email: Notificações enviadas para seu email cadastrado
- Discord: Notificações no servidor do Discord (se conectado)
- SMS: Disponível em planos pagos

Configurar Notificações:
1. Acesse seu perfil no dashboard
2. Vá em "Preferências" > "Notificações"
3. Escolha seus canais preferidos
4. Salve as alterações

Não está recebendo notificações?
- Verifique se o produto atingiu o preço alvo
- Confirme que as notificações estão ativadas
- Verifique sua caixa de spam (para emails)
- Certifique-se de que está no servidor do Discord (se usar Discord)

Se o problema persistir, nossa equipe de suporte entrará em contato!`
            }
        ]
    },
    geral: {
        keywords: ['ajuda', 'help', 'dúvida', 'duvida', 'como', 'funciona', 'tutorial', 'guia'],
        responses: [
            {
                condition: () => true,
                response: `Olá! Obrigado por entrar em contato. Como posso ajudá-lo hoje?

Para melhor atendê-lo, preciso de algumas informações:

Por favor, forneça:
1. Seu nome completo
2. Seu email cadastrado
3. Qual é a sua dúvida ou problema?

Exemplo de como responder:
Nome: João Silva
Email: joao.silva@exemplo.com
Dúvida: Não consigo fazer login na minha conta

Com essas informações, posso direcioná-lo melhor e fornecer uma solução mais precisa.

Aguardo suas informações! 😊`
            }
        ]
    }
};

/**
 * Verifica se a mensagem contém informações do usuário (nome, email, dúvida)
 */
function hasUserInfo(message) {
    const lowerMessage = message.toLowerCase();
    
    // Verificar se contém email (padrão básico)
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const hasEmail = emailPattern.test(message);
    
    // Verificar se menciona nome ou tem mais de 10 caracteres (provavelmente tem nome)
    const hasName = lowerMessage.includes('meu nome é') || 
                    lowerMessage.includes('nome:') ||
                    lowerMessage.includes('chamo-me') ||
                    lowerMessage.length > 20; // Mensagens longas provavelmente têm nome
    
    // Verificar se tem dúvida/problema descrito
    const hasQuestion = lowerMessage.includes('dúvida') ||
                        lowerMessage.includes('duvida') ||
                        lowerMessage.includes('problema') ||
                        lowerMessage.includes('preciso') ||
                        lowerMessage.includes('ajuda') ||
                        lowerMessage.includes('?') ||
                        lowerMessage.length > 30; // Mensagens longas provavelmente descrevem o problema
    
    return {
        hasEmail: hasEmail,
        hasName: hasName,
        hasQuestion: hasQuestion,
        complete: hasEmail && hasName && hasQuestion
    };
}

/**
 * Analisa a mensagem e identifica a categoria
 */
function categorizeMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    for (const [category, config] of Object.entries(CATEGORIES)) {
        if (category === 'geral') continue; // Skip geral, será usado como fallback
        
        for (const keyword of config.keywords) {
            if (lowerMessage.includes(keyword.toLowerCase())) {
                return category;
            }
        }
    }
    
    return 'geral';
}

/**
 * Gera resposta automática baseada na categoria e mensagem
 */
function generateAutoResponse(message, category) {
    const categoryConfig = CATEGORIES[category];
    if (!categoryConfig || !categoryConfig.responses) {
        return null;
    }
    
    // Tenta encontrar uma resposta específica
    for (const responseConfig of categoryConfig.responses) {
        if (responseConfig.condition(message)) {
            return responseConfig.response;
        }
    }
    
    return null;
}

export function getDeterministicSupportReply(message) {
    if (!message || typeof message !== 'string') return null;
    const category = categorizeMessage(message);
    if (!['login', 'produtos', 'notificacoes'].includes(category)) {
        return null;
    }

    const reply = generateAutoResponse(message, category);
    if (!reply) return null;

    return { category, reply };
}

/**
 * Verifica se a thread precisa de resposta automática
 * Retorna true se é a primeira mensagem do usuário na thread
 */
async function shouldSendAutoResponse(threadId, referenciaID) {
    try {
        const [messages] = await pool.query(
            `SELECT id, senderType, createdAt, message
             FROM supportmessages 
             WHERE threadId = ? OR id = ?
             ORDER BY createdAt ASC
             LIMIT 10`,
            [threadId, threadId]
        );
        
        // Se há apenas 1 mensagem e é do usuário, enviar resposta automática (primeira mensagem)
        if (messages.length === 1 && messages[0].senderType === 'user') {
            return { shouldSend: true, isFirstMessage: true };
        }
        
        // Se há 2 mensagens e a segunda é do suporte, verificar se é a mensagem de boas-vindas
        if (messages.length === 2 && messages[1].senderType === 'support') {
            const supportMessage = messages[1].message.toLowerCase();
            // Se a mensagem de suporte contém "Por favor, forneça", é a mensagem inicial
            if (supportMessage.includes('por favor, forneça') || supportMessage.includes('nome completo')) {
                // Usuário já recebeu a mensagem inicial, não enviar novamente
                return { shouldSend: false, isFirstMessage: false };
            }
        }
        
        // Se a última mensagem é do usuário e não há resposta automática recente
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.senderType === 'user') {
            // Verificar se há resposta automática recente (últimas 2 mensagens)
            const recentSupportMessages = messages.filter(m => 
                m.senderType === 'support' && 
                m.id > lastMessage.id - 2
            );
            if (recentSupportMessages.length === 0) {
                return { shouldSend: true, isFirstMessage: false };
            }
        }
        
        return { shouldSend: false, isFirstMessage: false };
    } catch (error) {
        console.error('[AUTO-SUPPORT] Erro ao verificar necessidade de resposta:', error);
        return { shouldSend: false, isFirstMessage: false };
    }
}

/**
 * Mensagem inicial de boas-vindas pedindo informações
 */
const WELCOME_MESSAGE = `Olá! Bem-vindo ao suporte do PromoPing!

Para melhor atendê-lo, preciso de algumas informações:

Por favor, forneça:
1. Seu nome completo
2. Seu email cadastrado
3. Qual é a sua dúvida ou problema?

Exemplo de como responder:
Nome: João Silva
Email: joao.silva@exemplo.com
Dúvida: Não consigo fazer login na minha conta

Com essas informações, posso direcioná-lo melhor e fornecer uma solução mais precisa.

Aguardo suas informações! 😊`;

/**
 * Envia resposta automática para uma thread
 */
export async function sendAutoResponse(threadId, userMessage, referenciaID) {
    try {
        // Verificar se deve enviar resposta automática
        const checkResult = await shouldSendAutoResponse(threadId, referenciaID);
        if (!checkResult.shouldSend) {
            console.log('[AUTO-SUPPORT] Resposta automática não necessária para thread', threadId);
            return null;
        }
        
        let autoResponse;
        let category = 'geral';
        
        // Se é a primeira mensagem, sempre enviar mensagem de boas-vindas
        if (checkResult.isFirstMessage) {
            autoResponse = WELCOME_MESSAGE;
            console.log('[AUTO-SUPPORT] Enviando mensagem de boas-vindas');
        } else {
            // Verificar se o usuário forneceu as informações solicitadas
            const userInfo = hasUserInfo(userMessage);
            
            if (!userInfo.complete) {
                // Se não forneceu todas as informações, pedir novamente
                let missingInfo = [];
                if (!userInfo.hasName) missingInfo.push('seu nome completo');
                if (!userInfo.hasEmail) missingInfo.push('seu email cadastrado');
                if (!userInfo.hasQuestion) missingInfo.push('qual é a sua dúvida ou problema');
                
                if (missingInfo.length > 0) {
                    // Criar exemplo baseado nas informações faltantes
                    let exemplo = '';
                    if (!userInfo.hasName) exemplo += 'Nome: João Silva\n';
                    if (!userInfo.hasEmail) exemplo += 'Email: joao.silva@exemplo.com\n';
                    if (!userInfo.hasQuestion) exemplo += 'Dúvida: Não consigo fazer login na minha conta';
                    
                    autoResponse = `Olá! Obrigado por entrar em contato. 

Para melhor atendê-lo, ainda preciso de algumas informações:

Por favor, forneça:
${missingInfo.map((info, index) => `${index + 1}. ${info}`).join('\n')}

Exemplo de como responder:
${exemplo}

Com essas informações, posso direcioná-lo melhor e fornecer uma solução mais precisa.

Aguardo suas informações! 😊`;
                } else {
                    // Categorizar a mensagem
                    category = categorizeMessage(userMessage);
                    console.log('[AUTO-SUPPORT] Categoria identificada:', category);
                    
                    // Gerar resposta automática
                    autoResponse = generateAutoResponse(userMessage, category);
                    
                    // Se não encontrou resposta específica, usar resposta geral
                    if (!autoResponse) {
                        autoResponse = CATEGORIES.geral.responses[0].response;
                    }
                }
            } else {
                // Usuário forneceu todas as informações, categorizar e responder
                category = categorizeMessage(userMessage);
                console.log('[AUTO-SUPPORT] Categoria identificada:', category);
                
                // Gerar resposta automática
                autoResponse = generateAutoResponse(userMessage, category);
                
                // Se não encontrou resposta específica, usar resposta geral
                if (!autoResponse) {
                    autoResponse = CATEGORIES.geral.responses[0].response;
                }
            }
        }
        
        // Buscar informações do usuário para personalizar
        const [userInfo] = await pool.query(
            `SELECT Nome, Email FROM utilizadores WHERE ReferenciaID = ?`,
            [referenciaID]
        );
        
        let personalizedResponse = autoResponse;
        if (userInfo.length > 0 && !checkResult.isFirstMessage) {
            const userName = userInfo[0].Nome;
            
            // Personalizar resposta com informações do usuário se disponíveis
            personalizedResponse = autoResponse.replace(/Olá!/g, `Olá ${userName || ''}!`.trim());
        }
        
        // Inserir resposta automática
        const [result] = await pool.query(
            `INSERT INTO supportmessages (ReferenciaID, message, senderType, replyTo, threadId)
             VALUES (?, ?, 'support', ?, ?)`,
            [referenciaID, personalizedResponse, threadId, threadId]
        );
        
        console.log('[AUTO-SUPPORT] Resposta automática enviada:', result.insertId);
        
        return {
            id: result.insertId,
            message: personalizedResponse,
            category: category
        };
    } catch (error) {
        console.error('[AUTO-SUPPORT] Erro ao enviar resposta automática:', error);
        return null;
    }
}

/**
 * Verifica se a mensagem precisa escalar para suporte humano
 * Retorna true se o usuário pediu explicitamente ou se já houve múltiplas tentativas
 */
export async function shouldEscalateToHuman(threadId) {
    try {
        const [messages] = await pool.query(
            `SELECT message, senderType 
             FROM supportmessages 
             WHERE threadId = ? OR id = ?
             ORDER BY createdAt ASC`,
            [threadId, threadId]
        );
        
        // Contar mensagens do usuário
        const userMessages = messages.filter(m => m.senderType === 'user');
        const supportMessages = messages.filter(m => m.senderType === 'support');
        
        // Se o usuário enviou mais de 3 mensagens e já recebeu respostas automáticas
        if (userMessages.length >= 3 && supportMessages.length >= 2) {
            // Verificar se o usuário pediu ajuda humana
            const lastUserMessage = userMessages[userMessages.length - 1].message.toLowerCase();
            const humanKeywords = ['humano', 'pessoa', 'atendente', 'operador', 'suporte real', 'falar com alguém', 'falar com alguem'];
            
            if (humanKeywords.some(keyword => lastUserMessage.includes(keyword))) {
                return true;
            }
            
            // Se já houve muitas interações, escalar
            if (userMessages.length >= 4) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('[AUTO-SUPPORT] Erro ao verificar escalação:', error);
        return false;
    }
}

/**
 * Envia mensagem de escalação para suporte humano
 */
export async function escalateToHuman(threadId, referenciaID) {
    try {
        const escalationMessage = `Olá! Vejo que ainda precisa de ajuda. 

Nossa equipe de suporte humano foi notificada e entrará em contato o mais breve possível para ajudá-lo com seu problema.

Enquanto isso, se tiver informações adicionais sobre seu problema, sinta-se à vontade para compartilhar. Isso nos ajudará a resolver mais rapidamente.

Obrigado pela paciência! 😊`;

        const [result] = await pool.query(
            `INSERT INTO supportmessages (ReferenciaID, message, senderType, replyTo, threadId)
             VALUES (?, ?, 'support', ?, ?)`,
            [referenciaID, escalationMessage, threadId, threadId]
        );
        
        console.log('[AUTO-SUPPORT] Thread escalada para suporte humano:', threadId);
        
        // Aqui você pode adicionar lógica para notificar administradores
        // Por exemplo, enviar email, criar notificação, etc.
        
        return {
            id: result.insertId,
            message: escalationMessage,
            escalated: true
        };
    } catch (error) {
        console.error('[AUTO-SUPPORT] Erro ao escalar para suporte humano:', error);
        return null;
    }
}
