import fetch from 'node-fetch';

// ================== CONFIGURAÇÃO ==================
const BASE_URL = 'http://localhost:3000/api';

// ================== FUNÇÕES DE TESTE ==================

async function testarCriarComponente() {
  console.log('🔧 Testando: Criar novo componente');
  
  const dados = {
    nome: 'Extensão Chrome',
    status: 'operational',
    uptime: 99.8,
    latencia: 25,
    detalhes: {
      versao: '1.0.0',
      descricao: 'Extensão do navegador Chrome'
    },
    notas: 'Teste do painel administrativo'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/componentes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log(`✅ Sucesso: Componente criado com ID ${result.componente.Id}`);
      console.log(`   - Nome: ${result.componente.Nome}`);
      console.log(`   - Status: ${result.componente.Status}`);
      return result.componente.Id;
    } else {
      console.log('❌ Erro:', result.erro);
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return null;
  }
}

async function testarAtualizarComponente(id) {
  console.log(`🔧 Testando: Atualizar componente ${id}`);
  
  const dados = {
    status: 'degraded',
    uptime: 95.5,
    latencia: 150,
    notas: 'Atualização via painel administrativo - teste'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/componentes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log(`✅ Sucesso: Componente atualizado`);
      console.log(`   - Novo status: ${result.componente.Status}`);
      console.log(`   - Novo uptime: ${result.componente.Uptime}%`);
      console.log(`   - Nova latência: ${result.componente.Latencia}ms`);
      return true;
    } else {
      console.log('❌ Erro:', result.erro);
      return false;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return false;
  }
}

async function testarListarComponentes() {
  console.log('📋 Testando: Listar componentes');
  
  try {
    const response = await fetch(`${BASE_URL}/componentes`);
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log(`✅ Sucesso: ${result.total} componentes encontrados`);
      result.componentes.forEach(comp => {
        console.log(`   - ${comp.Nome} (${comp.Status}) - Uptime: ${comp.Uptime}%`);
      });
      return result.componentes;
    } else {
      console.log('❌ Erro:', result.erro);
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return null;
  }
}

async function testarStatusGeral() {
  console.log('📊 Testando: Status geral do sistema');
  
  try {
    const response = await fetch(`${BASE_URL}/status`);
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log(`✅ Sucesso: Status obtido`);
      console.log(`   - Componentes: ${result.componentes.length}`);
      console.log(`   - Incidentes: ${result.incidentes.length}`);
      console.log(`   - Métricas disponíveis: ${Object.keys(result.metricas).length}`);
      return result;
    } else {
      console.log('❌ Erro:', result.erro);
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return null;
  }
}

async function testarIncidentes() {
  console.log('🚨 Testando: Listar incidentes');
  
  try {
    const response = await fetch(`${BASE_URL}/incidentes`);
    const result = await response.json();
    
    if (Array.isArray(result)) {
      console.log(`✅ Sucesso: ${result.length} incidentes encontrados`);
      result.forEach(inc => {
        console.log(`   - ${inc.Titulo} (${inc.Status})`);
      });
      return result;
    } else {
      console.log('❌ Erro: Resposta inválida');
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return null;
  }
}

async function testarHealthCheck() {
  console.log('🏥 Testando: Health check');
  
  try {
    const response = await fetch(`${BASE_URL}/status/health`);
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log(`✅ Sucesso: Sistema saudável`);
      console.log(`   - Database: ${result.health.database}`);
      console.log(`   - Uptime: ${result.health.uptime}s`);
      console.log(`   - Tabelas: ${result.health.tables.total}`);
      return true;
    } else {
      console.log('❌ Erro:', result.health?.error || 'Sistema não saudável');
      return false;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return false;
  }
}

// ================== CENÁRIOS DE TESTE ==================

async function executarTesteCompleto() {
  console.log('🚀 Iniciando teste completo do painel administrativo...\n');
  
  // 1. Health check
  const healthOk = await testarHealthCheck();
  console.log('');
  
  if (!healthOk) {
    console.log('❌ Sistema não está saudável. Verifique o servidor e banco de dados.');
    return;
  }
  
  // 2. Status geral
  await testarStatusGeral();
  console.log('');
  
  // 3. Listar componentes existentes
  const componentes = await testarListarComponentes();
  console.log('');
  
  // 4. Criar novo componente
  const novoId = await testarCriarComponente();
  console.log('');
  
  if (novoId) {
    // 5. Atualizar componente criado
    await testarAtualizarComponente(novoId);
    console.log('');
  }
  
  // 6. Testar incidentes
  await testarIncidentes();
  console.log('');
  
  // 7. Verificar se tudo ainda funciona
  await testarStatusGeral();
  console.log('');
  
  console.log('✅ Teste completo finalizado!');
  console.log('🎯 O painel administrativo está pronto para uso.');
}

async function executarTesteRapido() {
  console.log('⚡ Executando teste rápido do painel...\n');
  
  // Teste básico de conectividade
  const healthOk = await testarHealthCheck();
  
  if (healthOk) {
    // Teste de listagem
    await testarListarComponentes();
    console.log('');
    console.log('✅ Teste rápido concluído - sistema funcionando!');
  } else {
    console.log('❌ Sistema não está respondendo corretamente.');
  }
}

// ================== EXECUÇÃO ==================
const comando = process.argv[2];

if (comando === 'rapido') {
  executarTesteRapido();
} else {
  executarTesteCompleto();
}
