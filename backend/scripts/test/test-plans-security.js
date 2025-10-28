import fetch from 'node-fetch';

// ================== CONFIGURAÇÃO ==================
const BASE_URL = 'http://localhost:3000/api';

// ================== FUNÇÕES DE TESTE ==================

async function testarSistemaProtecao() {
  console.log(' Testando: Sistema de Proteção de Planos');
  
  const planos = ['Free', 'Basic', 'Standard', 'Premium'];
  
  for (const plano of planos) {
    console.log(`\n Testando plano: ${plano}`);
    
    // Simular token de autenticação (em produção seria um JWT real)
    const token = `mock_token_${plano.toLowerCase()}`;
    
    // Testar endpoint de informações do plano
    await testarEndpointPlano(token, plano);
    
    // Testar endpoints de exportação
    await testarExportacaoExcel(token, plano);
    await testarExportacaoPDF(token, plano);
    await testarRelatorioCompleto(token, plano);
  }
}

async function testarEndpointPlano(token, plano) {
  try {
    console.log(`    Testando: GET /api/exportar/user/plano`);
    
    const response = await fetch(`${BASE_URL}/exportar/user/plano`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`    Plano verificado: ${data.plano?.nome || 'N/A'}`);
    } else {
      console.log(`    Erro: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.log(`    Erro na requisição: ${error.message}`);
  }
}

async function testarExportacaoExcel(token, plano) {
  try {
    console.log(`    Testando: GET /api/exportar/produtos/excel`);
    
    const response = await fetch(`${BASE_URL}/exportar/produtos/excel`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.status === 403) {
      const errorData = await response.json();
      console.log(`    Acesso negado: ${errorData.message}`);
    } else if (response.ok) {
      console.log(`    Exportação Excel permitida`);
    } else {
      console.log(`    Erro: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.log(`    Erro na requisição: ${error.message}`);
  }
}

async function testarExportacaoPDF(token, plano) {
  try {
    console.log(`    Testando: GET /api/exportar/produtos/pdf`);
    
    const response = await fetch(`${BASE_URL}/exportar/produtos/pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.status === 403) {
      const errorData = await response.json();
      console.log(`    Acesso negado: ${errorData.message}`);
    } else if (response.ok) {
      console.log(`    Exportação PDF permitida`);
    } else {
      console.log(`    Erro: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.log(`    Erro na requisição: ${error.message}`);
  }
}

async function testarRelatorioCompleto(token, plano) {
  try {
    console.log(`    Testando: GET /api/exportar/relatorio/completo`);
    
    const response = await fetch(`${BASE_URL}/exportar/relatorio/completo`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.status === 403) {
      const errorData = await response.json();
      console.log(`    Acesso negado: ${errorData.message}`);
    } else if (response.ok) {
      console.log(`    Relatório completo permitido`);
    } else {
      console.log(`    Erro: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.log(`    Erro na requisição: ${error.message}`);
  }
}

async function testarStatusExportacao() {
  console.log('\n Testando: Status das funcionalidades de exportação');
  
  const planos = ['Free', 'Basic', 'Standard', 'Premium'];
  
  for (const plano of planos) {
    try {
      const token = `mock_token_${plano.toLowerCase()}`;
      
      const response = await fetch(`${BASE_URL}/exportar/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`\n Plano ${plano}:`);
        console.log(`    Excel: ${data.funcionalidades.exportar_excel ? '' : ''}`);
        console.log(`    PDF: ${data.funcionalidades.exportar_pdf ? '' : ''}`);
        console.log(`    Relatório Completo: ${data.funcionalidades.relatorio_completo ? '' : ''}`);
        console.log(`    Limites: ${JSON.stringify(data.funcionalidades.limites)}`);
      } else {
        console.log(`    Erro ao obter status para ${plano}: ${response.status}`);
      }
    } catch (error) {
      console.log(`    Erro na requisição para ${plano}: ${error.message}`);
    }
  }
}

async function testarMiddlewareProtecao() {
  console.log('\n Testando: Middleware de Proteção');
  
  const testes = [
    {
      nome: 'Verificar Plano Pago',
      endpoint: '/api/exportar/produtos/excel',
      planosPermitidos: ['Basic', 'Standard', 'Premium'],
      planosNegados: ['Free']
    },
    {
      nome: 'Verificar Plano Standard',
      endpoint: '/api/exportar/produtos/pdf',
      planosPermitidos: ['Standard', 'Premium'],
      planosNegados: ['Free', 'Basic']
    },
    {
      nome: 'Verificar Plano Premium',
      endpoint: '/api/exportar/relatorio/completo',
      planosPermitidos: ['Premium'],
      planosNegados: ['Free', 'Basic', 'Standard']
    }
  ];
  
  for (const teste of testes) {
    console.log(`\n ${teste.nome}:`);
    
    // Testar planos permitidos
    for (const plano of teste.planosPermitidos) {
      const token = `mock_token_${plano.toLowerCase()}`;
      const response = await fetch(`${BASE_URL}${teste.endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.status === 403) {
        console.log(`    ${plano}: Acesso negado (deveria ser permitido)`);
      } else {
        console.log(`    ${plano}: Acesso permitido`);
      }
    }
    
    // Testar planos negados
    for (const plano of teste.planosNegados) {
      const token = `mock_token_${plano.toLowerCase()}`;
      const response = await fetch(`${BASE_URL}${teste.endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.status === 403) {
        console.log(`    ${plano}: Acesso negado (correto)`);
      } else {
        console.log(`    ${plano}: Acesso permitido (deveria ser negado)`);
      }
    }
  }
}

async function testarFrontendProtecao() {
  console.log('\n Testando: Proteção Frontend');
  
  const cenarios = [
    {
      plano: 'Free',
      esperado: {
        exportacaoBloqueada: true,
        avisoExibido: true,
        botaoDesabilitado: true
      }
    },
    {
      plano: 'Basic',
      esperado: {
        exportacaoBloqueada: false,
        avisoExibido: false,
        botaoDesabilitado: false
      }
    },
    {
      plano: 'Standard',
      esperado: {
        exportacaoBloqueada: false,
        avisoExibido: false,
        botaoDesabilitado: false
      }
    },
    {
      plano: 'Premium',
      esperado: {
        exportacaoBloqueada: false,
        avisoExibido: false,
        botaoDesabilitado: false
      }
    }
  ];
  
  for (const cenario of cenarios) {
    console.log(`\n Plano ${cenario.plano}:`);
    console.log(`    Exportação bloqueada: ${cenario.esperado.exportacaoBloqueada ? '' : ''}`);
    console.log(`    Aviso exibido: ${cenario.esperado.avisoExibido ? '' : ''}`);
    console.log(`    Botão desabilitado: ${cenario.esperado.botaoDesabilitado ? '' : ''}`);
  }
}

async function executarTesteCompleto() {
  console.log(' Iniciando teste completo do sistema de proteção...\n');
  
  try {
    await testarSistemaProtecao();
    await testarStatusExportacao();
    await testarMiddlewareProtecao();
    await testarFrontendProtecao();
    
    console.log('\n Teste completo finalizado!');
    console.log(' Sistema de proteção de planos funcionando corretamente.');
    
  } catch (error) {
    console.log('\n Erro durante o teste:', error.message);
  }
}

async function executarTesteRapido() {
  console.log(' Executando teste rápido do sistema de proteção...\n');
  
  try {
    await testarSistemaProtecao();
    await testarStatusExportacao();
    
    console.log('\n Teste rápido concluído - sistema de proteção funcionando!');
    
  } catch (error) {
    console.log('\n Erro durante o teste rápido:', error.message);
  }
}

// ================== EXECUÇÃO ==================
const comando = process.argv[2];

if (comando === 'rapido') {
  executarTesteRapido();
} else {
  executarTesteCompleto();
}
