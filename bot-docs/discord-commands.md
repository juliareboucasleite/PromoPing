# 🤖 Comandos Discord - PromoPing

## 📋 Lista de Comandos

### 🔐 **Autenticação**

#### `/registrar`
Registra uma nova conta no PromoPing usando seu Discord.

**Parâmetros:**
- `email` (opcional): Seu email para sincronização

**Exemplo:**
```
/registrar email:joao@exemplo.com
```

**O que faz:**
- Cria uma nova conta vinculada ao seu Discord
- Se fornecer email, verifica se já existe e vincula
- Gera token de acesso para usar no site
- Cria configurações padrão

---

#### `/login`
Faz login na sua conta PromoPing existente.

**Parâmetros:**
- Nenhum

**Exemplo:**
```
/login
```

**O que faz:**
- Verifica se você já tem conta vinculada
- Atualiza informações do Discord
- Gera novo token de acesso
- Mostra estatísticas da conta

---

#### `/sincronizar`
Sincroniza sua conta Discord com uma conta existente no site.

**Parâmetros:**
- `email`: Email da sua conta no site

**Exemplo:**
```
/sincronizar email:joao@exemplo.com
```

**O que faz:**
- Verifica se email existe no site
- Pede confirmação de senha
- Vincula Discord à conta existente
- Mantém todos os produtos e configurações

---

### 📦 **Gestão de Produtos**

#### `/meus-produtos`
Lista todos os seus produtos monitorados.

**Parâmetros:**
- `pagina` (opcional): Número da página (5 produtos por página)

**Exemplo:**
```
/meus-produtos pagina:2
```

**O que faz:**
- Mostra lista paginada dos produtos
- Exibe preços atuais e alvos
- Mostra status (ativo/inativo)
- Inclui botões de navegação

---

#### `/adicionar-produto`
Adiciona um novo produto para monitorar preços.

**Parâmetros:**
- Nenhum (abre modal)

**Exemplo:**
```
/adicionar-produto
```

**O que faz:**
- Abre formulário para preencher:
  - Nome do produto
  - URL do produto
  - Preço alvo (opcional)
  - Loja (opcional)
- Valida URL e preços
- Adiciona à sua lista de produtos

---

### ⚙️ **Configurações**

#### `/configuracoes`
Gerencia suas configurações de notificação.

**Parâmetros:**
- Nenhum (abre modal)

**Exemplo:**
```
/configuracoes
```

**O que faz:**
- Permite configurar:
  - Notificações Discord
  - Notificações Email
  - Frequência de verificação
- Salva preferências

---

## 🔄 **Sincronização com o Site**

### **Como Funciona:**
1. **Registre-se no Discord** usando `/registrar`
2. **Copie o token** fornecido
3. **Acesse o site** e use o token para login
4. **Tudo fica sincronizado** automaticamente!

### **Vantagens:**
- ✅ **Acesso duplo**: Discord + Site
- ✅ **Sincronização automática**: Mudanças em um refletem no outro
- ✅ **Notificações**: Receba alertas no Discord
- ✅ **Gestão completa**: Adicione produtos em qualquer lugar

---

## 🚀 **Fluxo de Uso Recomendado**

### **Para Novos Usuários:**
1. `/registrar` - Crie sua conta
2. `/adicionar-produto` - Adicione produtos
3. `/meus-produtos` - Veja sua lista
4. Acesse o site com o token

### **Para Usuários Existentes:**
1. `/sincronizar` - Vincule sua conta
2. `/meus-produtos` - Veja produtos existentes
3. Continue usando Discord + Site

---

## 🔧 **Resolução de Problemas**

### **"Conta não encontrada"**
- Use `/registrar` para criar nova conta
- Use `/sincronizar` se já tem conta no site

### **"Token inválido"**
- Use `/login` para gerar novo token
- Verifique se a conta está ativa

### **"Erro ao adicionar produto"**
- Verifique se a URL é válida
- Certifique-se de estar logado

### **"Sessão expirada"**
- Use `/login` para renovar sessão
- Tokens Discord duram 7 dias

---

## 📱 **Integração com o Site**

### **Login no Site:**
1. Acesse https://promoping.com
2. Clique em "Login com Discord"
3. Cole o token do comando `/login`
4. Pronto! Tudo sincronizado

### **Funcionalidades Sincronizadas:**
- ✅ Lista de produtos
- ✅ Configurações de notificação
- ✅ Histórico de preços
- ✅ Preferências de usuário

---

## 🎯 **Dicas de Uso**

### **Organização:**
- Use nomes descritivos para produtos
- Defina preços alvo realistas
- Organize por loja quando possível

### **Notificações:**
- Configure alertas no Discord
- Use `/configuracoes` para personalizar
- Receba notificações em tempo real

### **Produtividade:**
- Use `/meus-produtos` para ver tudo
- Adicione produtos rapidamente
- Monitore preços sem sair do Discord

---

**🎉 Agora você pode gerenciar seus produtos diretamente do Discord!**
