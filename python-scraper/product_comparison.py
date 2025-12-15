"""
Módulo principal para comparação de produtos entre lojas.
Integra extração de informações, normalização, pesquisa e matching.
"""
import logging
from scraper import extract_product_info, create_driver, safe_quit
from ai_product_matcher import normalize_product, generate_search_query, match_products
from product_search import search_all_stores

logger = logging.getLogger(__name__)


def compare_product_across_stores(product_url):
    """
    Função principal: compara produto em múltiplas lojas europeias.
    
    Fluxo:
    1. Extrai informações do produto original
    2. Normaliza produto usando IA
    3. Gera query de pesquisa
    4. Pesquisa em todas as lojas
    5. Faz matching semântico de cada resultado
    6. Retorna lista comparativa ordenada por confiança
    
    Args:
        product_url: URL do produto original
    
    Returns:
        Dict com:
        - original: informações do produto original
        - normalized: produto normalizado
        - comparisons: lista de comparações [{store, title, price, url, confidence, match}, ...]
        - success: bool indicando sucesso
        - error: mensagem de erro se houver
    """
    driver = None
    
    try:
        logger.info(f"Iniciando comparação de produto: {product_url}")
        
        # Criar driver
        driver = create_driver()
        
        # 1. Extrair informações do produto original
        logger.info("Extraindo informações do produto original...")
        original_info = extract_product_info(driver, product_url)
        
        if not original_info.get("title"):
            logger.warning("Não foi possível extrair título do produto")
            return {
                "success": False,
                "error": "Não foi possível extrair informações do produto",
                "original": original_info,
                "normalized": None,
                "comparisons": []
            }
        
        # 2. Normalizar produto usando IA
        logger.info("Normalizando produto com IA...")
        normalized = normalize_product(original_info)
        
        if not normalized.get("brand") and not normalized.get("model"):
            logger.warning("Normalização não retornou informações suficientes")
            # Continuar mesmo assim, usando título como fallback
        
        # 3. Gerar query de pesquisa
        search_query = generate_search_query(normalized)
        logger.info(f"Query de pesquisa gerada: {search_query}")
        
        # 4. Pesquisar em todas as lojas
        logger.info("Pesquisando em todas as lojas...")
        search_results = search_all_stores(driver, search_query)
        
        if not search_results:
            logger.warning("Nenhum resultado encontrado nas lojas")
            return {
                "success": True,
                "error": None,
                "original": original_info,
                "normalized": normalized,
                "comparisons": []
            }
        
        logger.info(f"Encontrados {len(search_results)} resultados para matching")
        
        # 5. Fazer matching semântico de cada resultado
        comparisons = []
        for result in search_results:
            try:
                # Extrair informações do resultado candidato
                candidate_info = extract_product_info(driver, result["url"])
                
                # Fazer matching
                match_result = match_products(original_info, candidate_info)
                
                comparisons.append({
                    "store": result["store"],
                    "title": result["title"],
                    "price": result["price"],
                    "url": result["url"],
                    "confidence": match_result["confidence"],
                    "match": match_result["match"],
                    "reason": match_result.get("reason", "")
                })
                
                logger.info(f"Matching {result['store']}: {match_result['match']} (confiança: {match_result['confidence']:.2f})")
                
            except Exception as e:
                logger.error(f"Erro ao fazer matching de {result.get('url', 'unknown')}: {e}")
                # Adicionar resultado sem matching
                comparisons.append({
                    "store": result["store"],
                    "title": result["title"],
                    "price": result["price"],
                    "url": result["url"],
                    "confidence": 0.0,
                    "match": False,
                    "reason": "Erro no matching"
                })
        
        # 6. Ordenar por confiança (maior primeiro) e depois por preço (menor primeiro)
        comparisons.sort(key=lambda x: (-x["confidence"], x["price"] if x["price"] else float('inf')))
        
        # Filtrar apenas matches com confiança >= 0.5 (opcional - pode ser ajustado)
        high_confidence_matches = [c for c in comparisons if c["match"] and c["confidence"] >= 0.5]
        
        logger.info(f"Comparação concluída: {len(high_confidence_matches)} matches de alta confiança")
        
        return {
            "success": True,
            "error": None,
            "original": {
                "title": original_info.get("title"),
                "url": original_info.get("url")
            },
            "normalized": normalized,
            "comparisons": comparisons,
            "high_confidence_matches": high_confidence_matches
        }
        
    except Exception as e:
        logger.error(f"Erro na comparação de produtos: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "original": None,
            "normalized": None,
            "comparisons": []
        }
    finally:
        if driver:
            safe_quit(driver)
            logger.info("Driver fechado após comparação")


def compare_product_simple(product_url):
    """
    Versão simplificada que retorna apenas resultados de alta confiança.
    Útil para integração rápida.
    
    Args:
        product_url: URL do produto original
    
    Returns:
        Lista simplificada de comparações com alta confiança
    """
    result = compare_product_across_stores(product_url)
    
    if not result["success"]:
        return []
    
    # Retornar apenas matches de alta confiança com informações essenciais
    return [
        {
            "loja": c["store"],
            "preco": c["price"],
            "url": c["url"],
            "confianca": round(c["confidence"], 2),
            "titulo": c["title"]
        }
        for c in result.get("high_confidence_matches", [])
    ]

