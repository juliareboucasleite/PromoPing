"""
Módulo para análise e matching de produtos usando OpenAI API.
Responsável por normalização semântica e matching de produtos.
"""
from openai import OpenAI
import json
import os
import logging
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

logger = logging.getLogger(__name__)

# Inicializar cliente OpenAI
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.warning("OPENAI_API_KEY não encontrada nas variáveis de ambiente")
    client = None
else:
    client = OpenAI(api_key=api_key)

def normalize_product(product_info):
    """
    Normaliza informações do produto usando OpenAI API.
    
    Args:
        product_info: Dict com 'title', 'url', 'raw_text'
    
    Returns:
        Dict normalizado com: brand, model, category, storage, color, keywords
    """
    if not client:
        logger.error("OpenAI client não inicializado - verifique OPENAI_API_KEY")
        return {
            "brand": "",
            "model": "",
            "category": "",
            "storage": "",
            "color": "",
            "keywords": ""
        }
    
    try:
        prompt = f"""Analisa as informações do produto abaixo e extrai dados normalizados.

TÍTULO: {product_info.get('title', '')}
TEXTO RELEVANTE: {product_info.get('raw_text', '')[:4000]}

Responde APENAS em JSON válido com os seguintes campos:
- brand: marca do produto (ex: "Apple", "Samsung", "Sony")
- model: modelo específico (ex: "iPhone 15 Pro", "Galaxy S23")
- category: categoria (ex: "Smartphone", "Laptop", "Headphones")
- storage: capacidade de armazenamento se aplicável (ex: "256GB", "1TB", "")
- color: cor se especificada (ex: "Preto", "Branco", "")
- keywords: array de palavras-chave relevantes para busca (máximo 10)

Se algum campo não for identificável, use string vazia "".
Para keywords, use apenas termos essenciais para busca do produto.

Resposta JSON:"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Modelo mais recente e econômico
            messages=[
                {
                    "role": "system",
                    "content": "És um especialista em análise de produtos de e-commerce. Extrai informações normalizadas de forma precisa e consistente."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1,  # Temperatura baixa para respostas consistentes
            response_format={"type": "json_object"}  # Forçar JSON válido
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Validar estrutura
        required_fields = ["brand", "model", "category", "storage", "color", "keywords"]
        for field in required_fields:
            if field not in result:
                result[field] = "" if field != "keywords" else []
        
        # Garantir que keywords é uma lista
        if not isinstance(result.get("keywords"), list):
            keywords_str = result.get("keywords", "")
            if isinstance(keywords_str, str):
                result["keywords"] = [k.strip() for k in keywords_str.split(",") if k.strip()][:10]
            else:
                result["keywords"] = []
        
        logger.info(f"Produto normalizado: {result.get('brand')} {result.get('model')}")
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Erro ao decodificar JSON da OpenAI: {e}")
        return {
            "brand": "",
            "model": "",
            "category": "",
            "storage": "",
            "color": "",
            "keywords": []
        }
    except Exception as e:
        logger.error(f"Erro ao normalizar produto: {e}")
        return {
            "brand": "",
            "model": "",
            "category": "",
            "storage": "",
            "color": "",
            "keywords": []
        }


def generate_search_query(normalized_product):
    """
    Gera query de pesquisa a partir do produto normalizado.
    
    Args:
        normalized_product: Dict com informações normalizadas
    
    Returns:
        String com query de pesquisa otimizada
    """
    parts = []
    
    if normalized_product.get("brand"):
        parts.append(normalized_product["brand"])
    
    if normalized_product.get("model"):
        parts.append(normalized_product["model"])
    
    # Adicionar storage se relevante
    if normalized_product.get("storage"):
        parts.append(normalized_product["storage"])
    
    # Se não tem brand/model, usar keywords
    if not parts and normalized_product.get("keywords"):
        parts.extend(normalized_product["keywords"][:3])
    
    query = " ".join(parts).strip()
    
    # Fallback se query vazia
    if not query:
        query = normalized_product.get("category", "produto")
    
    return query


def match_products(original_product_info, candidate_product_info):
    """
    Verifica se dois produtos correspondem usando matching semântico.
    
    Args:
        original_product_info: Dict com informações do produto original
        candidate_product_info: Dict com informações do produto candidato
    
    Returns:
        Dict com 'match' (bool) e 'confidence' (float 0-1)
    """
    if not client:
        logger.warning("OpenAI client não disponível - matching não pode ser realizado")
        return {"match": False, "confidence": 0.0}
    
    try:
        prompt = f"""Compara dois produtos e determina se são o mesmo produto.

PRODUTO ORIGINAL:
Título: {original_product_info.get('title', '')}
Texto: {original_product_info.get('raw_text', '')[:2000]}

PRODUTO CANDIDATO:
Título: {candidate_product_info.get('title', '')}
Texto: {candidate_product_info.get('raw_text', '')[:2000]}

Responde APENAS em JSON válido com:
- match: true se são o mesmo produto, false caso contrário
- confidence: número entre 0.0 e 1.0 indicando nível de confiança
- reason: breve explicação (máximo 50 caracteres)

Considera:
- Mesma marca e modelo = match alto
- Diferenças apenas em cor/storage = match alto
- Produtos diferentes = match baixo
- Informações insuficientes = match baixo

Resposta JSON:"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "És um especialista em matching de produtos. Compara produtos de forma precisa e objetiva."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Validar resultado
        match = result.get("match", False)
        confidence = float(result.get("confidence", 0.0))
        confidence = max(0.0, min(1.0, confidence))  # Garantir range 0-1
        
        return {
            "match": match,
            "confidence": confidence,
            "reason": result.get("reason", "")
        }
        
    except Exception as e:
        logger.error(f"Erro ao fazer matching de produtos: {e}")
        return {"match": False, "confidence": 0.0, "reason": "Erro no matching"}
