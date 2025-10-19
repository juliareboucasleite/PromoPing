import fetch from 'node-fetch';

// ================== CONFIGURAÇÃO ==================
const BASE_URL = 'http://localhost:3000/api';

// ================== FUNÇÕES DE TESTE ==================

async function testarCriarIncidente() {
  console.log('🚨 Testando: Criar novo incidente');
  
  const dados = {
    titulo: 'Falha na API de notificações',
    descricao: 'A API de notificações está retornando erro 500 para algumas requisições',
    impacto: 'Atraso no envio de emails para usuários',
    estado: 'investigating',
    componenteId: 1
  };
  
  try {
    const response = await fetch(`${BASE_URL}/incidentes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log(`✅ Sucesso: Incidente criado com ID ${result.incidente.Id}`);
      console.log(`   - Título: ${result.incidente.Titulo}`);
      console.log(`   - Status: ${result.incidente.Status}`);
      console.log(`   - Componente: ${result.incidente.ComponentesAfetados}`);
      return result.incidente.Id;
    } else {
      console.log('❌ Erro:', result.erro);
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
    return null;
  }
}

async function testarEncerrarIncidente(id) {
  console.log(`🔒 Testando: Encerrar incidente ${id}`);
  
  try {
    const response = await fetch(`${BASE_URL}/incidentes/${id}/encerrar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log(`✅ Sucesso: Incidente encerrado`);
      console.log(`   - Status: ${result.incidente.Status}`);
      console.log(`   - Data Fim: ${result.incidente.DataFim}`);
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

async function testarAtualizarIncidente(id) {
  console.log(`✏️ Testando: Atualizar incidente ${id}`);
  
  const dados = {
    titulo: 'Falha na API de notificações - ATUALIZADO',
    descricao: 'Problema identificado: timeout na conexão com o servidor de email',
    impacto: 'Atraso no envio de emails - investigação em andamento',
    estado: 'identified'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/incidentes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log(`✅ Sucesso: Incidente atualizado`);
      console.log(`   - Novo título: ${result.incidente.Titulo}`);
      console.log(`   - Novo status: ${result.incidente.Status}`);
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

async function testarListarIncidentes() {
  console.log('📋 Testando: Listar incidentes');
  
  try {
    const response = await fetch(`${BASE_URL}/incidentes`);
    const result = await response.json();
    
    if (Array.isArray(result)) {
      console.log(`✅ Sucesso: ${result.length} incidentes encontrados`);
      result.forEach(inc => {
        console.log(`   - ${inc.Titulo} (${inc.Status}) - ${inc.DataInicio}`);
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

async function testarStatusGeral() {
  console.log('📊 Testando: Status geral com incidentes');
  
  try {
    const response = await fetch(`${BASE_URL}/status`);
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log(`✅ Sucesso: Status obtido`);
      console.log(`   - Componentes: ${result.componentes.length}`);
      console.log(`   - Incidentes: ${result.incidentes.length}`);
      console.log(`   - Métricas: ${Object.keys(result.metricas).length} campos`);
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

// ================== CENÁRIOS DE TESTE ==================

async function executarTesteCompleto() {
  console.log('🚀 Iniciando teste completo da API de incidentes...\n');
  
  // 1. Status geral
  await testarStatusGeral();
  console.log('');
  
  // 2. Listar incidentes existentes
  const incidentes = await testarListarIncidentes();
  console.log('');
  
  // 3. Criar novo incidente
  const novoId = await testarCriarIncidente();
  console.log('');
  
  if (novoId) {
    // 4. Atualizar incidente criado
    await testarAtualizarIncidente(novoId);
    console.log('');
    
    // 5. Encerrar incidente
    await testarEncerrarIncidente(novoId);
    console.log('');
  }
  
  // 6. Verificar status final
  await testarStatusGeral();
  console.log('');
  
  console.log('✅ Teste completo finalizado!');
  console.log('🎯 A API de incidentes está funcionando corretamente.');
}

async function executarTesteRapido() {
  console.log('⚡ Executando teste rápido de incidentes...\n');
  
  // Teste básico de listagem
  const incidentes = await testarListarIncidentes();
  
  if (incidentes && incidentes.length > 0) {
    // Teste de encerramento do primeiro incidente ativo
    const incidenteAtivo = incidentes.find(inc => inc.Status !== 'resolved');
    if (incidenteAtivo) {
      console.log(`\n🔒 Testando encerramento do incidente ${incidenteAtivo.Id}...`);
      await testarEncerrarIncidente(incidenteAtivo.Id);
    }
  }
  
  console.log('\n✅ Teste rápido finalizado!');
}

// ================== EXECUÇÃO ==================
const comando = process.argv[2];

if (comando === 'rapido') {
  executarTesteRapido();
} else {
  executarTesteCompleto();
}
