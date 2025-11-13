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

{% code title="Clonar repositório" %}
```
```
{% endcode %}
{% endstep %}

{% step %}
### Instalar Dependências

Entre no diretório do projeto e instale as dependências:

{% code title="Instalar dependências" %}
```
```
{% endcode %}
{% endstep %}

{% step %}
### Configuração do Ambiente

Crie um ficheiro `.env` no directório raiz com as variáveis de ambiente necessárias. Exemplo:

{% code title=".env (exemplo)" %}
```
```
{% endcode %}
{% endstep %}

{% step %}
### Configuração da Base de Dados

Execute as migrações da base de dados para criar as tabelas e estruturas necessárias:

{% code title="Executar migrações" %}
```
```
{% endcode %}
{% endstep %}

{% step %}
### Iniciar a Aplicação

Inicie a aplicação com o comando:

{% code title="Iniciar aplicação" %}
```
```
{% endcode %}
{% endstep %}
{% endstepper %}

### Configuração Inicial

Assim que a aplicação estiver a funcionar:

* Abra o seu navegador e navegue para `http://localhost:3000`
* Crie a sua primeira conta de administrador
* Configure as suas preferências de notificação
* Adicione o seu primeiro produto para monitorizar

### Resolução de Problemas

<details>

<summary>Ver dicas de resolução de problemas</summary>

* Verifique se todas as variáveis de ambiente estão correctamente definidas.
* Certifique-se de que o MySQL está a funcionar e acessível.
* Verifique se todas as portas necessárias estão disponíveis.
* Verifique os logs da consola para mensagens de erro específicas.

</details>
