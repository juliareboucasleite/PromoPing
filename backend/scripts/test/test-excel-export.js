import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// ================== CONFIGURAÇÃO ==================
const BASE_URL = 'http://localhost:3000/api';

// ================== FUNÇÕES DE TESTE ==================

async function testarExportacaoExcel() {
  console.log(' Testando: Exportação para Excel');
  
  try {
    const response = await fetch(`${BASE_URL}/incidentes/exportar`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.log(' Erro na resposta:', errorData);
      return false;
    }
    
    // Verificar se é um arquivo Excel
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('spreadsheetml')) {
      console.log(' Tipo de conteúdo inválido:', contentType);
      return false;
    }
    
    // Verificar se há dados para download
    const contentLength = response.headers.get('content-length');
    if (!contentLength || parseInt(contentLength) === 0) {
      console.log(' Arquivo vazio');
      return false;
    }
    
    console.log(` Sucesso: Arquivo Excel gerado`);
    console.log(`   - Tipo: ${contentType}`);
    console.log(`   - Tamanho: ${contentLength} bytes`);
    console.log(`   - Content-Disposition: ${response.headers.get('content-disposition')}`);
    
    return true;
    
  } catch (error) {
    console.log(' Erro na requisição:', error.message);
    return false;
  }
}

async function testarCriarIncidentesParaTeste() {
  console.log(' Criando incidentes de teste para exportação...');
  
  const incidentesTeste = [
    {
      titulo: 'Falha na API de notificações',
      descricao: 'API retornando erro 500 para algumas requisições',
      impacto: 'Atraso no envio de emails',
      estado: 'investigating',
      componenteId: 1
    },
    {
      titulo: 'Manutenção programada - Sistema de Preços',
      descricao: 'Atualização de segurança e otimizações',
      impacto: 'Serviço indisponível por 2 horas',
      estado: 'identified',
      componenteId: 2
    },
    {
      titulo: 'Degradação de performance - Banco de Dados',
      descricao: 'Alta latência nas consultas',
      impacto: 'Resposta lenta do sistema',
      estado: 'monitoring',
      componenteId: 3
    }
  ];
  
  let criados = 0;
  
  for (const incidente of incidentesTeste) {
    try {
      const response = await fetch(`${BASE_URL}/incidentes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidente)
      });
      
      if (response.ok) {
        criados++;
        console.log(`    Incidente criado: ${incidente.titulo}`);
      } else {
        console.log(`    Erro ao criar: ${incidente.titulo}`);
      }
    } catch (error) {
      console.log(`    Erro na requisição: ${incidente.titulo}`);
    }
  }
  
  console.log(` Total de incidentes criados: ${criados}/${incidentesTeste.length}`);
  return criados > 0;
}

async function testarListarIncidentes() {
  console.log(' Verificando incidentes disponíveis...');
  
  try {
    const response = await fetch(`${BASE_URL}/incidentes`);
    const incidentes = await response.json();
    
    if (Array.isArray(incidentes)) {
      console.log(` ${incidentes.length} incidentes encontrados`);
      incidentes.forEach(inc => {
        console.log(`   - ${inc.Titulo} (${inc.Status})`);
      });
      return incidentes.length > 0;
    } else {
      console.log(' Resposta inválida');
      return false;
    }
  } catch (error) {
    console.log(' Erro na requisição:', error.message);
    return false;
  }
}

async function testarStatusGeral() {
  console.log(' Verificando status geral do sistema...');
  
  try {
    const response = await fetch(`${BASE_URL}/status`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log(` Sistema funcionando`);
      console.log(`   - Componentes: ${data.componentes.length}`);
      console.log(`   - Incidentes: ${data.incidentes.length}`);
      return true;
    } else {
      console.log(' Sistema com problemas');
      return false;
    }
  } catch (error) {
    console.log(' Erro na requisição:', error.message);
    return false;
  }
}

// ================== CENÁRIOS DE TESTE ==================

async function executarTesteCompleto() {
  console.log(' Iniciando teste completo de exportação Excel...\n');
  
  // 1. Verificar status do sistema
  const sistemaOk = await testarStatusGeral();
  console.log('');
  
  if (!sistemaOk) {
    console.log(' Sistema não está funcionando. Verifique o servidor.');
    return;
  }
  
  // 2. Verificar incidentes existentes
  const temIncidentes = await testarListarIncidentes();
  console.log('');
  
  // 3. Se não há incidentes, criar alguns para teste
  if (!temIncidentes) {
    await testarCriarIncidentesParaTeste();
    console.log('');
  }
  
  // 4. Testar exportação Excel
  const exportacaoOk = await testarExportacaoExcel();
  console.log('');
  
  if (exportacaoOk) {
    console.log(' Teste completo finalizado com sucesso!');
    console.log(' A funcionalidade de exportação Excel está funcionando.');
  } else {
    console.log(' Teste falhou. Verifique os logs acima.');
  }
}

async function executarTesteRapido() {
  console.log(' Executando teste rápido de exportação Excel...\n');
  
  // Teste direto da exportação
  const exportacaoOk = await testarExportacaoExcel();
  
  if (exportacaoOk) {
    console.log('\n Teste rápido concluído - exportação funcionando!');
  } else {
    console.log('\n Teste rápido falhou - verifique se há incidentes e se o servidor está rodando.');
  }
}

// ================== EXECUÇÃO ==================
const comando = process.argv[2];

if (comando === 'rapido') {
  executarTesteRapido();
} else {
  executarTesteCompleto();
}
