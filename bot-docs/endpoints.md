# Endpoints - PromoPing

## /scrape
- **Descrição:** Extrai o nome e preço de um produto através do link fornecido.
- **Método:** GET
- **Parâmetros:** `url` (string)

## /notify
- **Descrição:** Envia notificação aos bots configurados.
- **Método:** POST
- **Body:** JSON com canal e mensagem.
