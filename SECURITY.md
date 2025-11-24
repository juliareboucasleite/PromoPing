# Política de Segurança do PromoPing

<<<<<<< Updated upstream
## Versão Suportada

Apenas a versão mais recente do PromoPing recebe atualizações de segurança. Recomendamos manter o sistema sempre atualizado.

=======
>>>>>>> Stashed changes
## Reportar uma Vulnerabilidade

A segurança é uma prioridade para o PromoPing. Se descobrir uma vulnerabilidade de segurança, agradecemos que nos informe de forma responsável.

<<<<<<< Updated upstream
**NÃO** reporte vulnerabilidades de segurança através de issues públicos no GitHub. Em vez disso, envie um email para: **corporation.promoping@gmail.com**

Inclua no seu reporte: tipo de vulnerabilidade, localização do código afetado, passos para reproduzir, impacto potencial e sugestões de correção (se houver).
=======
**NÃO** reporte vulnerabilidades de segurança através de issues públicos no GitHub. Em vez disso, envie um email detalhado para **corporation.promoping@gmail.com**. Discuta vulnerabilidades apenas por email, e não em público.

Exemplos de detalhes para incluir no seu reporte:
- Idealmente uma breve descrição (ou um script) para demonstrar uma exploração
- As plataformas e cenários afetados
- O nome e a afiliação dos pesquisadores de segurança (se aplicável)
- Se a vulnerabilidade já foi divulgada
- Quanto tempo um embargo seria necessário para ser seguro

Receberá uma confirmação do recebimento do reporte em até 48 horas, uma resposta inicial com avaliação da vulnerabilidade em até 7 dias, atualizações sobre o progresso da correção conforme necessário e reconhecimento público (se desejar) após a correção ser implementada.

## Versões Suportadas
>>>>>>> Stashed changes

Atualmente, apenas a versão mais recente do PromoPing recebe atualizações de segurança. Recomendamos manter o sistema sempre atualizado.

<<<<<<< Updated upstream
Receberá uma confirmação do recebimento do reporte em até 48 horas, uma resposta inicial com avaliação da vulnerabilidade em até 7 dias, atualizações sobre o progresso da correção conforme necessário e reconhecimento público (se desejar) após a correção ser implementada.

## Medidas de Segurança Implementadas

**Autenticação e Autorização**: JWT (JSON Web Tokens), middleware de verificação em todas as rotas protegidas, validação de propriedade de recursos, senhas hashadas com bcrypt, suporte para OAuth 2.0 (Google).

**Proteção de Dados**: Prepared statements para prevenir SQL Injection, sanitização de input, HTTPS em produção, rate limiting, CORS configurado.

**Segurança de API**: Validação rigorosa de entrada, rate limiting por rota, timeout de requisições, headers de segurança HTTP.

**Segurança do Banco de Dados**: Pool de conexões seguro, credenciais em variáveis de ambiente, backup regular, princípio do menor privilégio.

**Segurança do Frontend**: Content Security Policy (CSP), prevenção de XSS, cookies seguros, validação client-side.

**Segurança do Scraper Python**: Isolamento de processos, validação de URLs, timeout de requisições, user-agent configurável.

## Boas Práticas

**Para Desenvolvedores**: Nunca commitar credenciais (use variáveis de ambiente), atualizar dependências regularmente, code review antes de merge, executar testes de segurança, aplicar princípio do menor privilégio.

**Para Administradores**: Monitorar logs regularmente, manter backups atualizados e testados, atualizar sistema operacional, configurar firewall adequadamente, manter certificados SSL válidos.

## Checklist de Segurança

**Antes de Deploy em Produção**: Todas as variáveis de ambiente configuradas, credenciais não estão no código, HTTPS configurado e funcionando, rate limiting ativo, CORS configurado corretamente, logs de segurança habilitados, backup configurado e testado, firewall configurado, certificados SSL válidos, dependências atualizadas e sem vulnerabilidades conhecidas.

**Manutenção Regular**: Atualizar dependências mensalmente, revisar logs de segurança semanalmente, testar backups mensalmente, revisar permissões de usuários trimestralmente, auditoria de segurança anual.

## Vulnerabilidades Conhecidas

Atualmente não há vulnerabilidades conhecidas. Se descobrir alguma, por favor reporte seguindo o processo acima.

## Histórico de Correções de Segurança

**2025 - 25/11/2025**: Vulnerabilidade corrigida onde o utilizador coloca o link e abre já o scraping. Severidade: Baixa.

## Contato

Para questões de segurança: **corporation.promoping@gmail.com**
=======
Não há versões de "Suporte a longo prazo" oficiais. As correções são feitas para a branch de manutenção da versão de feature mais recente. Correções críticas de vulnerabilidades são aplicadas à branch mais recente e pelo menos uma ou duas tracks de manutenção mais antigas.
>>>>>>> Stashed changes

**Última atualização**: Novembro 2025
