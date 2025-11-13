# FirstLaunch

## Começar

### Bem-vindo ao PromoPing!

Este guia irá ajudá-lo a configurar o PromoPing pela primeira vez e a monitorizar os seus produtos favoritos em minutos.

### Requisitos do Sistema

Antes de começar, certifique-se de que o seu sistema cumpre estes requisitos:

* Node.js 16.0 ou superior
* MySQL 8.0 ou superior
* Pelo menos 2GB de RAM disponível
* Conexão estável à internet

### Passos de Instalação

{% stepper %}
{% step %}
### Clonar o Repositório

Execute o comando para clonar o repositório:

```bash
git clone https://github.com/yourusername/PromoPing-2.0.1.git
```
{% endstep %}

{% step %}
### Instalar Dependências

Navegue até ao diretório do projeto e instale as dependências:

```bash
cd PromoPing-2.0.1
npm install
```
{% endstep %}

{% step %}
### Configuração do Ambiente

Crie um ficheiro `.env` no directório raiz com as variáveis necessárias. Exemplo:

```env
# Configuração da Base de Dados
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=promoping

# Chaves da API
STRIPE_SECRET_KEY=your_stripe_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Configuração do Servidor
PORT=3000
NODE_ENV=development
```
{% endstep %}

{% step %}
### Configuração da Base de Dados

Execute as migrações da base de dados:

```bash
npm run migrate
```
{% endstep %}

{% step %}
### Iniciar a Aplicação

Inicie a aplicação com:

```bash
npm start
```
{% endstep %}
{% endstepper %}

### Configuração Inicial

Assim que a aplicação estiver a funcionar, siga estes passos:

{% stepper %}
{% step %}
Abra o seu navegador e navegue para `http://localhost:3000`.
{% endstep %}

{% step %}
Crie a sua primeira conta de administrador.
{% endstep %}

{% step %}
Configure as suas preferências de notificação.
{% endstep %}

{% step %}
Adicione o seu primeiro produto para monitorizar.
{% endstep %}
{% endstepper %}

### Resolução de Problemas

<details>

<summary>Ver problemas comuns e soluções</summary>

* Verifique se todas as variáveis de ambiente estão correctamente definidas.
* Certifique-se de que o MySQL está a funcionar e acessível.
* Verifique se todas as portas necessárias estão disponíveis.
* Consulte os logs da consola para mensagens de erro específicas.

</details>
