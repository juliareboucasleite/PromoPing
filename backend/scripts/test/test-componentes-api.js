import fetch from 'node-fetch';

// ================== CONFIGURAÇÃO ==================
const BASE_URL = 'http://localhost:3000';

// ================== FUNÇÕES DE TESTE ==================

async function testarListarComponentes() {
  console.log('🔍 Testando: Listar todos os componentes');
  try {
    const response = await fetch(`${BASE_URL}/api/componentes`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log(`✅ Sucesso: ${data.total} componentes encontrados`);
      data.componentes.forEach(comp => {
        console.log(`   - ${comp.Nome} (${comp.Status})`);
      });
      return data.componentes;
    } else {
      console.log('❌ Erro:', data.erro);
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return null;
  }
}

async function testarObterComponente(id) {
  console.log(`🔍 Testando: Obter componente ${id}`);
  try {
    const response = await fetch(`${BASE_URL}/api/componentes/${id}`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log(`✅ Sucesso: Componente encontrado`);
      console.log(`   - Nome: ${data.componente.Nome}`);
      console.log(`   - Status: ${data.componente.Status}`);
      console.log(`   - Uptime: ${data.componente.Uptime}%`);
      return data.componente;
    } else {
      console.log('❌ Erro:', data.erro);
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return null;
  }
}

async function testarAtualizarComponente(id, dados) {
  console.log(`🔧 Testando: Atualizar componente ${id}`);
  console.log(`   Dados:`, JSON.stringify(dados, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/api/componentes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });
    
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log(`✅ Sucesso: Componente atualizado`);
      console.log(`   - Novo status: ${data.componente.Status}`);
      if (data.componente.Notas) {
        console.log(`   - Notas: ${data.componente.Notas}`);
      }
      return data.componente;
    } else {
      console.log('❌ Erro:', data.erro);
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return null;
  }
}

async function testarCriarComponente(dados) {
  console.log(`➕ Testando: Criar novo componente`);
  console.log(`   Dados:`, JSON.stringify(dados, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/api/componentes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });
    
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log(`✅ Sucesso: Componente criado com ID ${data.componente.Id}`);
      console.log(`   - Nome: ${data.componente.Nome}`);
      console.log(`   - Status: ${data.componente.Status}`);
      return data.componente;
    } else {
      console.log('❌ Erro:', data.erro);
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
    const response = await fetch(`${BASE_URL}/api/status`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log(`✅ Sucesso: Status obtido`);
      console.log(`   - Componentes: ${data.componentes.length}`);
      console.log(`   - Incidentes: ${data.incidentes.length}`);
      console.log(`   - Última atualização: ${data.ultimaAtualizacao}`);
      return data;
    } else {
      console.log('❌ Erro:', data.erro);
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return null;
  }
}

// ================== CENÁRIOS DE TESTE ==================

async function executarCenarioCompleto() {
  console.log('🚀 Iniciando teste completo da API de componentes...\n');
  
  // 1. Listar componentes existentes
  const componentes = await testarListarComponentes();
  console.log('');
  
  if (!componentes || componentes.length === 0) {
    console.log('❌ Nenhum componente encontrado. Execute primeiro: npm run status:setup');
    return;
  }
  
  // 2. Obter um componente específico
  await testarObterComponente(1);
  console.log('');
  
  // 3. Atualizar status do componente 1
  await testarAtualizarComponente(1, {
    status: 'degraded',
    notas: 'Teste de atualização via API'
  });
  console.log('');
  
  // 4. Atualizar múltiplos campos
  await testarAtualizarComponente(2, {
    status: 'outage',
    uptime: 85.5,
    latencia: 500,
    notas: 'Manutenção de emergência - teste da API'
  });
  console.log('');
  
  // 5. Criar novo componente
  const novoComponente = await testarCriarComponente({
    nome: 'Cache Redis',
    status: 'operational',
    uptime: 99.8,
    latencia: 5,
    detalhes: {
      descricao: 'Sistema de cache Redis',
      versao: '6.2.7',
      memoria: '512MB'
    }
  });
  console.log('');
  
  // 6. Verificar status geral
  await testarStatusGeral();
  console.log('');
  
  // 7. Restaurar status original (se necessário)
  if (novoComponente) {
    console.log('🧹 Limpando componente de teste...');
    // Nota: Não implementamos DELETE, mas podemos atualizar para "removido"
    await testarAtualizarComponente(novoComponente.Id, {
      status: 'outage',
      notas: 'Componente de teste - pode ser removido'
    });
  }
  
  console.log('✅ Teste completo finalizado!');
}

async function executarTesteRapido() {
  console.log('⚡ Executando teste rápido...\n');
  
  // Teste básico de listagem
  const componentes = await testarListarComponentes();
  
  if (componentes && componentes.length > 0) {
    // Teste de atualização simples
    await testarAtualizarComponente(1, {
      status: 'operational',
      notas: 'Teste rápido - ' + new Date().toISOString()
    });
  }
  
  console.log('✅ Teste rápido finalizado!');
}

// ================== EXECUÇÃO ==================
const comando = process.argv[2];

if (comando === 'rapido') {
  executarTesteRapido();
} else {
  executarCenarioCompleto();
}
