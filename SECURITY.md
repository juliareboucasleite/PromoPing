# Política de Segurança do PromoPing

## Versão Suportada

Atualmente, apenas a versão mais recente do PromoPing recebe atualizações de segurança. Recomendamos manter o sistema sempre atualizado.

## Reportar uma Vulnerabilidade

A segurança é uma prioridade para o PromoPing. Se descobrir uma vulnerabilidade de segurança, agradecemos que nos informe de forma responsável.

### Como Reportar

**NÃO** reporte vulnerabilidades de segurança através de issues públicos no GitHub.

Em vez disso, envie um email para: **corporation.promoping@gmail.com** (ou o email de contato do mantenedor)

Inclua o seguinte no seu reporte:
- Tipo de vulnerabilidade
- Localização do código afetado
- Passos para reproduzir
- Impacto potencial
- Sugestões de correção (se houver)

### O que Esperar

- Receberá uma confirmação do recebimento do reporte em até 48 horas
- Uma resposta inicial com avaliação da vulnerabilidade em até 7 dias
- Atualizações sobre o progresso da correção conforme necessário
- Reconhecimento público (se desejar) após a correção ser implementada

## Medidas de Segurança Implementadas

### Autenticação e Autorização

- **JWT (JSON Web Tokens)**: Sistema de autenticação baseado em tokens
- **Middleware de Verificação**: Todas as rotas protegidas verificam tokens JWT
- **Validação de Usuário**: Verificação de propriedade de recursos antes de operações
- **Senhas Hashadas**: Utilização de bcrypt para hash de senhas
- **OAuth 2.0**: Suporte para autenticação via Google OAuth

### Proteção de Dados

- **Prepared Statements**: Todas as queries SQL usam prepared statements para prevenir SQL Injection
- **Sanitização de Input**: Validação e sanitização de todos os dados de entrada
- **HTTPS**: Comunicação criptografada em produção
- **Rate Limiting**: Limitação de requisições para prevenir abuso
- **CORS Configurado**: Políticas de CORS adequadas para produção

### Segurança de API

- **Validação de Entrada**: Validação rigorosa de todos os parâmetros de entrada
- **Rate Limiting por Rota**: Diferentes limites para diferentes endpoints
- **Timeout de Requisições**: Timeouts configurados para prevenir DoS
- **Headers de Segurança**: Headers HTTP de segurança configurados

### Segurança do Banco de Dados

- **Conexões Seguras**: Pool de conexões com configurações seguras
- **Credenciais em Variáveis de Ambiente**: Nenhuma credencial hardcoded
- **Backup Regular**: Sistema de backup implementado
- **Princípio do Menor Privilégio**: Usuários do banco com permissões mínimas necessárias

### Segurança do Frontend

- **Content Security Policy (CSP)**: Políticas de segurança de conteúdo
- **XSS Prevention**: Sanitização de dados antes de exibição
- **Secure Cookies**: Cookies configurados com flags de segurança
- **Validação Client-Side**: Validação adicional no frontend (não substitui validação do backend)

### Segurança do Scraper Python

- **Isolamento de Processos**: Scraper executa em processo separado
- **Validação de URLs**: Verificação de URLs antes de scraping
- **Timeout de Requisições**: Timeouts para prevenir travamentos
- **User-Agent Configurável**: User-agent configurável para evitar bloqueios

## Boas Práticas de Segurança

### Para Desenvolvedores

1. **Nunca commitar credenciais**: Use variáveis de ambiente (.env)
2. **Atualizar dependências**: Mantenha todas as dependências atualizadas
3. **Revisar código**: Code review antes de merge
4. **Testes de segurança**: Execute testes de segurança regularmente
5. **Princípio do menor privilégio**: Conceda apenas permissões necessárias

### Para Administradores

1. **Monitorar logs**: Revise logs regularmente para atividades suspeitas
2. **Backups regulares**: Mantenha backups atualizados e testados
3. **Atualizações de sistema**: Mantenha o sistema operacional atualizado
4. **Firewall configurado**: Configure firewall adequadamente
5. **Certificados SSL**: Mantenha certificados SSL válidos e atualizados

## Checklist de Segurança

### Antes de Deploy em Produção

- [ ] Todas as variáveis de ambiente configuradas
- [ ] Credenciais não estão no código
- [ ] HTTPS configurado e funcionando
- [ ] Rate limiting ativo
- [ ] CORS configurado corretamente
- [ ] Logs de segurança habilitados
- [ ] Backup configurado e testado
- [ ] Firewall configurado
- [ ] Certificados SSL válidos
- [ ] Dependências atualizadas e sem vulnerabilidades conhecidas

### Manutenção Regular

- [ ] Atualizar dependências mensalmente
- [ ] Revisar logs de segurança semanalmente
- [ ] Testar backups mensalmente
- [ ] Revisar permissões de usuários trimestralmente
- [ ] Auditoria de segurança anual

## Vulnerabilidades Conhecidas

Atualmente não há vulnerabilidades conhecidas. Se descobrir alguma, por favor reporte seguindo o processo acima.

## Histórico de Correções de Segurança

### 2025
- **Data**: [25/11/2025]
- **Vulnerabilidade**: [0]
- **Severidade**: [Baixa]
- **Correção**: [Onde o utilizador coloca o link e abre já o scraping]

## Recursos Adicionais

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Python Security](https://python.readthedocs.io/en/stable/library/security_warnings.html)

## Contato

Para questões de segurança, entre em contato:
- **Email**: corporation.promoping@gmail.com

---

**Última atualização**: Novembro 2025

