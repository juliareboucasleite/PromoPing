# API de Componentes - Exemplos de Uso

Este documento contém exemplos práticos de como usar as rotas da API de componentes do PromoPing.

## 📋 Rotas Disponíveis

### 1. **PUT** `/api/componentes/:id` - Atualizar Componente
### 2. **GET** `/api/componentes/:id` - Obter Componente Específico
### 3. **GET** `/api/componentes` - Listar Todos os Componentes
### 4. **POST** `/api/componentes` - Criar Novo Componente

---

## 🔧 Exemplos de Uso

### 1. Atualizar Status de um Componente

**Método:** `PUT`  
**URL:** `http://localhost:3000/api/componentes/1`  
**Headers:** `Content-Type: application/json`

#### Exemplo 1: Atualizar apenas o status
```json
{
  "status": "degraded"
}
```

#### Exemplo 2: Atualizar múltiplos campos
```json
{
  "status": "outage",
  "uptime": 85.5,
  "latencia": 500,
  "notas": "Manutenção de emergência em andamento. Previsão de retorno: 2 horas."
}
```

#### Exemplo 3: Atualizar detalhes técnicos
```json
{
  "detalhes": {
    "versao": "1.2.3",
    "servidor": "web-01",
    "cpu": "85%",
    "memoria": "2.1GB/4GB"
  },
  "notas": "Alta utilização de CPU detectada"
}
```

### 2. Obter Informações de um Componente

**Método:** `GET`  
**URL:** `http://localhost:3000/api/componentes/1`

**Resposta:**
```json
{
  "status": "ok",
  "componente": {
    "Id": 1,
    "Nome": "API Principal",
    "Status": "operational",
    "Uptime": 99.9,
    "Latencia": 45,
    "UltimaVerificacao": "2024-01-15T14:30:00.000Z",
    "Detalhes": {
      "descricao": "API principal do PromoPing",
      "versao": "1.0.0"
    },
    "Notas": null
  },
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### 3. Listar Todos os Componentes

**Método:** `GET`  
**URL:** `http://localhost:3000/api/componentes`

**Resposta:**
```json
{
  "status": "ok",
  "componentes": [
    {
      "Id": 1,
      "Nome": "API Principal",
      "Status": "operational",
      "Uptime": 99.9,
      "Latencia": 45,
      "UltimaVerificacao": "2024-01-15T14:30:00.000Z",
      "Detalhes": {...},
      "Notas": null
    },
    {
      "Id": 2,
      "Nome": "Monitoramento de Preços",
      "Status": "operational",
      "Uptime": 99.7,
      "Latencia": 120,
      "UltimaVerificacao": "2024-01-15T14:30:00.000Z",
      "Detalhes": {...},
      "Notas": null
    }
  ],
  "total": 6,
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### 4. Criar Novo Componente

**Método:** `POST`  
**URL:** `http://localhost:3000/api/componentes`  
**Headers:** `Content-Type: application/json`

```json
{
  "nome": "Cache Redis",
  "status": "operational",
  "uptime": 99.8,
  "latencia": 5,
  "detalhes": {
    "descricao": "Sistema de cache Redis",
    "versao": "6.2.7",
    "memoria": "512MB"
  }
}
```

---

## 🛠️ Exemplos com JavaScript/Fetch

### Atualizar Componente via JavaScript
```javascript
async function atualizarComponente(id, dados) {
  try {
    const response = await fetch(`/api/componentes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });
    
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log('✅ Componente atualizado:', result.componente);
      return result;
    } else {
      console.error('❌ Erro:', result.erro);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro na requisição:', error);
    return null;
  }
}

// Exemplos de uso:
atualizarComponente(1, { status: 'degraded' });
atualizarComponente(2, { 
  status: 'outage', 
  notas: 'Manutenção programada' 
});
```

### Listar Componentes
```javascript
async function listarComponentes() {
  try {
    const response = await fetch('/api/componentes');
    const result = await response.json();
    
    if (result.status === 'ok') {
      console.log('📊 Componentes:', result.componentes);
      return result.componentes;
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}
```

---

## 🖥️ Exemplos com C# (Painel Admin)

### Classe para Componente
```csharp
public class Componente
{
    public int Id { get; set; }
    public string Nome { get; set; }
    public string Status { get; set; }
    public decimal Uptime { get; set; }
    public int Latencia { get; set; }
    public DateTime UltimaVerificacao { get; set; }
    public string Detalhes { get; set; }
    public string Notas { get; set; }
}

public class AtualizacaoComponente
{
    public string Status { get; set; }
    public decimal? Uptime { get; set; }
    public int? Latencia { get; set; }
    public string Notas { get; set; }
}
```

### Método para Atualizar Componente
```csharp
public async Task<bool> AtualizarComponente(int id, AtualizacaoComponente dados)
{
    try
    {
        using var httpClient = new HttpClient();
        var json = JsonSerializer.Serialize(dados);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        var response = await httpClient.PutAsync($"http://localhost:3000/api/componentes/{id}", content);
        
        if (response.IsSuccessStatusCode)
        {
            var responseContent = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<dynamic>(responseContent);
            return result.status == "ok";
        }
        
        return false;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Erro ao atualizar componente: {ex.Message}");
        return false;
    }
}
```

### Uso no Painel Admin
```csharp
// Exemplo de uso no botão de atualização
private async void btnAtualizarStatus_Click(object sender, EventArgs e)
{
    var dados = new AtualizacaoComponente
    {
        Status = "degraded",
        Notas = "Alta latência detectada - investigando"
    };
    
    bool sucesso = await AtualizarComponente(1, dados);
    
    if (sucesso)
    {
        MessageBox.Show("Status atualizado com sucesso!");
        // Atualizar interface
    }
    else
    {
        MessageBox.Show("Erro ao atualizar status!");
    }
}
```

---

## 🐍 Exemplos com Python

### Atualizar Componente
```python
import requests
import json

def atualizar_componente(id, dados):
    url = f"http://localhost:3000/api/componentes/{id}"
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.put(url, json=dados, headers=headers)
        result = response.json()
        
        if result["status"] == "ok":
            print(f"✅ Componente {id} atualizado com sucesso")
            return result["componente"]
        else:
            print(f"❌ Erro: {result['erro']}")
            return None
            
    except Exception as e:
        print(f"❌ Erro na requisição: {e}")
        return None

# Exemplos de uso:
atualizar_componente(1, {"status": "operational"})
atualizar_componente(2, {
    "status": "outage",
    "notas": "Manutenção de emergência"
})
```

---

## 📊 Status Válidos

| Status | Descrição | Cor |
|--------|-----------|-----|
| `operational` | Funcionando normalmente | 🟢 Verde |
| `degraded` | Funcionando com problemas | 🟡 Amarelo |
| `outage` | Fora do ar | 🔴 Vermelho |

---

## ⚠️ Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `400` | Dados inválidos ou campos obrigatórios ausentes |
| `404` | Componente não encontrado |
| `500` | Erro interno do servidor |

---

## 🔄 Atualização Automática

O frontend (`service-status.html`) atualiza automaticamente a cada 30 segundos, então as mudanças feitas via API serão refletidas automaticamente na interface.

---

**Última atualização:** Janeiro 2024  
**Versão da API:** 1.0.0
