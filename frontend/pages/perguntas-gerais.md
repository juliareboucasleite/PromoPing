# Perguntas Gerais

<details>

<summary>O que é o PromoPing?</summary>

O PromoPing é uma plataforma de monitoramento de preços que permite acompanhar produtos em múltiplas lojas online portuguesas e receber notificações automáticas quando os preços baixam, ajudando os utilizadores a poupar dinheiro nas suas compras.

</details>

<details>

<summary>Como funciona o sistema de monitoramento?</summary>

O PromoPing utiliza um sistema Python Scraper que verifica periodicamente os preços dos produtos nas lojas suportadas. Quando um preço atinge a meta definida pelo utilizador, o sistema envia notificações via Discord, email ou SMS.

</details>

<details>

<summary>Quais lojas são suportadas?</summary>

O PromoPing suporta mais de 20 lojas, incluindo Worten, FNAC, Continente, Pingo Doce, IKEA, Radio Popular, Auchan, PcDiga, Amazon e muitas outras. O sistema detecta automaticamente a loja a partir da URL do produto.

</details>

## Conta e Autenticação

<details>

<summary>Como criar uma conta?</summary>

Pode criar uma conta através do registo tradicional com email e password, ou usar login social com Google OAuth. Acesse a página de registo e siga as instruções.

</details>

<details>

<summary>Esqueci-me da password. Como recuperar?</summary>

Na página de login, clique em "Esqueci-me da password" e siga as instruções enviadas por email. Se não receber o email, verifique a pasta de spam.

</details>

<details>

<summary>Posso usar login social?</summary>

Sim! O PromoPing suporta login com Google OAuth e Discord. Basta clicar no botão correspondente na página de login.

</details>

## Planos e Limites

<details>

<summary>Quais são os planos disponíveis?</summary>

O PromoPing oferece 4 planos:

* **Free:** 5 produtos, verificação a cada 24h
* **Basic:** 25 produtos, verificação a cada 4h
* **Standard:** 100 produtos, verificação a cada 30min
* **Premium:** 500 produtos, verificação a cada 5min

</details>

<details>

<summary>Posso alterar o meu plano?</summary>

Sim, pode alterar o seu plano a qualquer momento através da página de planos no dashboard. As alterações são aplicadas imediatamente.

</details>

<details>

<summary>O que acontece se exceder o limite do meu plano?</summary>

Se exceder o limite de produtos, será notificado e poderá fazer upgrade do plano ou remover alguns produtos. O sistema continuará a monitorizar os produtos dentro do limite.

</details>

## Notificações

<details>

<summary>Como configurar notificações?</summary>

No dashboard, vá para "Preferências" e configure os canais de notificação desejados (Discord, email, SMS). Pode personalizar a frequência e tipos de alertas.

</details>

<details>

<summary>Porque não estou a receber notificações?</summary>

Verifique se:

* As notificações estão ativadas nas preferências
* O email está correto e verificado
* O bot do Discord está adicionado ao servidor
* As notificações não estão na pasta de spam

</details>

<details>

<summary>Posso desativar notificações temporariamente?</summary>

Sim, pode pausar as notificações nas preferências ou desativar notificações para produtos específicos.

</details>

## Problemas Técnicos

<details>

<summary>O site não carrega. O que fazer?</summary>

Verifique se:

* Tem ligação à internet
* O servidor está online (verifique o status do serviço)
* O seu navegador está atualizado
* Desative temporariamente o antivírus/firewall

</details>

<details>

<summary>Os preços não estão a ser atualizados. Porquê?</summary>

Isso pode acontecer por:

* Problemas temporários com as lojas
* Alterações na estrutura das páginas das lojas
* Limitações de rate limiting
* Problemas de conectividade

O sistema tenta automaticamente novamente no próximo ciclo.

</details>

<details>

<summary>Como reportar um bug?</summary>

Pode reportar bugs através da página de suporte ou enviando um email para corporation.promoping@gmail.com. Inclua detalhes sobre o problema e screenshots se possível.

</details>

## Privacidade e Segurança

<details>

<summary>Os meus dados estão seguros?</summary>

Sim, o PromoPing implementa medidas de segurança robustas incluindo:

* Autenticação JWT segura
* Rate limiting para prevenir abuso
* Sanitização de entradas
* Prepared statements para prevenir SQL injection
* Validação CORS segura

</details>

<details>

<summary>Posso eliminar a minha conta?</summary>

Sim, pode eliminar a sua conta a qualquer momento através das configurações do perfil. Todos os dados serão removidos permanentemente.

</details>

<details>

<summary>O PromoPing partilha os meus dados?</summary>

Não, o PromoPing não partilha os seus dados pessoais com terceiros. Consulte a nossa política de privacidade para mais detalhes.

</details>

## Funcionalidades Avançadas

<details>

<summary>Como funciona a detecção automática de loja?</summary>

O sistema analisa a URL do produto e identifica automaticamente a loja correspondente, aplicando o scraper adequado para cada loja.

</details>

<details>

<summary>Posso exportar os meus dados?</summary>

Sim, pode exportar os seus dados em formato Excel, PDF ou CSV através da página de exportação no dashboard.

</details>

<details>

<summary>Como funciona o sistema de períodos de graça?</summary>

Os períodos de graça permitem testar funcionalidades premium temporariamente. São geridos automaticamente pelo sistema.

</details>
