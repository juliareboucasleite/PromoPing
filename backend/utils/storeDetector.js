// detectStore.js
// Função para detectar loja pelo link
export function detectStore(link) {
  if (!link) {
    return { name: 'Desconhecida', domain: 'unknown', logo: '/assets/images/default-store.png' };
  }

  try {
    const url = new URL(link);
    let hostname = url.hostname.toLowerCase();

    // Remover www. se presente
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    if (hostname === 'amzn.eu' || hostname === 'amzn.to' || hostname.startsWith('amazon.') || hostname.includes('.amazon.')) {
      return {
        name: 'Amazon',
        domain: hostname,
        logo: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
      };
    }

    // Mapeamento de lojas conhecidas (simplificado)
    const storeMap = {
      //  Lojas portuguesas
      'worten.pt': { name: 'Worten', domain: 'worten.pt', logo: 'https://www.google.com/s2/favicons?domain=worten.pt&sz=32' },
      'fnac.pt': { name: 'FNAC', domain: 'fnac.pt', logo: 'https://www.google.com/s2/favicons?domain=fnac.pt&sz=32' },
      'mediamarkt.pt': { name: 'MediaMarkt', domain: 'mediamarkt.pt', logo: 'https://www.google.com/s2/favicons?domain=mediamarkt.pt&sz=32' },
      'pcdiga.pt': { name: 'PCDiga', domain: 'pcdiga.pt', logo: 'https://www.google.com/s2/favicons?domain=pcdiga.pt&sz=32' },
      'globaldata.pt': { name: 'GlobalData', domain: 'globaldata.pt', logo: 'https://www.google.com/s2/favicons?domain=globaldata.pt&sz=32' },
      'leroymerlin.pt': { name: 'Leroy Merlin', domain: 'leroymerlin.pt', logo: 'https://www.google.com/s2/favicons?domain=leroymerlin.pt&sz=32' },
      'ikea.pt': { name: 'IKEA', domain: 'ikea.pt', logo: 'https://www.google.com/s2/favicons?domain=ikea.pt&sz=32' },
      'hm.pt': { name: 'H&M', domain: 'hm.pt', logo: 'https://www.google.com/s2/favicons?domain=hm.pt&sz=32' },
      'zara.pt': { name: 'Zara', domain: 'zara.pt', logo: 'https://www.google.com/s2/favicons?domain=zara.pt&sz=32' },
      'radiopopular.pt': { name: 'Rádio Popular', domain: 'radiopopular.pt', logo: 'https://www.google.com/s2/favicons?domain=radiopopular.pt&sz=32' },
      'continente.pt': { name: 'Continente', domain: 'continente.pt', logo: 'https://www.google.com/s2/favicons?domain=continente.pt&sz=32' },
      'pingodoce.pt': { name: 'Pingo Doce', domain: 'pingodoce.pt', logo: 'https://www.google.com/s2/favicons?domain=pingodoce.pt&sz=32' },
      'auchan.pt': { name: 'Auchan', domain: 'auchan.pt', logo: 'https://www.google.com/s2/favicons?domain=auchan.pt&sz=32' },
      'elcorteingles.pt': { name: 'El Corte Inglés', domain: 'elcorteingles.pt', logo: 'https://www.google.com/s2/favicons?domain=elcorteingles.pt&sz=32' },
      'primark.pt': { name: 'Primark', domain: 'primark.pt', logo: 'https://www.google.com/s2/favicons?domain=primark.pt&sz=32' },
      'decathlon.pt': { name: 'Decathlon', domain: 'decathlon.pt', logo: 'https://www.google.com/s2/favicons?domain=decathlon.pt&sz=32' },
      'sportzone.pt': { name: 'Sport Zone', domain: 'sportzone.pt', logo: 'https://www.google.com/s2/favicons?domain=sportzone.pt&sz=32' },
      'footlocker.pt': { name: 'Foot Locker', domain: 'footlocker.pt', logo: 'https://www.google.com/s2/favicons?domain=footlocker.pt&sz=32' },
      'bershka.pt': { name: 'Bershka', domain: 'bershka.pt', logo: 'https://www.google.com/s2/favicons?domain=bershka.pt&sz=32' },
      'pullandbear.pt': { name: 'Pull & Bear', domain: 'pullandbear.pt', logo: 'https://www.google.com/s2/favicons?domain=pullandbear.pt&sz=32' },
      'stradivarius.pt': { name: 'Stradivarius', domain: 'stradivarius.pt', logo: 'https://www.google.com/s2/favicons?domain=stradivarius.pt&sz=32' },
      'massimodutti.pt': { name: 'Massimo Dutti', domain: 'massimodutti.pt', logo: 'https://www.google.com/s2/favicons?domain=massimodutti.pt&sz=32' },
      'oysho.pt': { name: 'Oysho', domain: 'oysho.pt', logo: 'https://www.google.com/s2/favicons?domain=oysho.pt&sz=32' },
      'lefties.pt': { name: 'Lefties', domain: 'lefties.pt', logo: 'https://www.google.com/s2/favicons?domain=lefties.pt&sz=32' },
      
      //  Lojas internacionais
      'apple.com': { name: 'Apple', domain: 'apple.com', logo: 'https://www.google.com/s2/favicons?domain=apple.com&sz=32' },
      'microsoft.com': { name: 'Microsoft', domain: 'microsoft.com', logo: 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=32' },
      'samsung.com': { name: 'Samsung', domain: 'samsung.com', logo: 'https://www.google.com/s2/favicons?domain=samsung.com&sz=32' },
      'sony.com': { name: 'Sony', domain: 'sony.com', logo: 'https://www.google.com/s2/favicons?domain=sony.com&sz=32' },
      'lg.com': { name: 'LG', domain: 'lg.com', logo: 'https://www.google.com/s2/favicons?domain=lg.com&sz=32' },
      'philips.com': { name: 'Philips', domain: 'philips.com', logo: 'https://www.google.com/s2/favicons?domain=philips.com&sz=32' },
      'bosch.com': { name: 'Bosch', domain: 'bosch.com', logo: 'https://www.google.com/s2/favicons?domain=bosch.com&sz=32' },
      'siemens.com': { name: 'Siemens', domain: 'siemens.com', logo: 'https://www.google.com/s2/favicons?domain=siemens.com&sz=32' },
      'miele.com': { name: 'Miele', domain: 'miele.com', logo: 'https://www.google.com/s2/favicons?domain=miele.com&sz=32' },
      'whirlpool.com': { name: 'Whirlpool', domain: 'whirlpool.com', logo: 'https://www.google.com/s2/favicons?domain=whirlpool.com&sz=32' },
      'electrolux.com': { name: 'Electrolux', domain: 'electrolux.com', logo: 'https://www.google.com/s2/favicons?domain=electrolux.com&sz=32' },
      'candy.com': { name: 'Candy', domain: 'candy.com', logo: 'https://www.google.com/s2/favicons?domain=candy.com&sz=32' },
      'hotpoint.com': { name: 'Hotpoint', domain: 'hotpoint.com', logo: 'https://www.google.com/s2/favicons?domain=hotpoint.com&sz=32' },
      'indesit.com': { name: 'Indesit', domain: 'indesit.com', logo: 'https://www.google.com/s2/favicons?domain=indesit.com&sz=32' },
      'beko.com': { name: 'Beko', domain: 'beko.com', logo: 'https://www.google.com/s2/favicons?domain=beko.com&sz=32' },
      'ariston.com': { name: 'Ariston', domain: 'ariston.com', logo: 'https://www.google.com/s2/favicons?domain=ariston.com&sz=32' },
      'zanussi.com': { name: 'Zanussi', domain: 'zanussi.com', logo: 'https://www.google.com/s2/favicons?domain=zanussi.com&sz=32' },
      'bauknecht.com': { name: 'Bauknecht', domain: 'bauknecht.com', logo: 'https://www.google.com/s2/favicons?domain=bauknecht.com&sz=32' },
      'gorenje.com': { name: 'Gorenje', domain: 'gorenje.com', logo: 'https://www.google.com/s2/favicons?domain=gorenje.com&sz=32' },
      'aeg.com': { name: 'AEG', domain: 'aeg.com', logo: 'https://www.google.com/s2/favicons?domain=aeg.com&sz=32' },
      'grundig.com': { name: 'Grundig', domain: 'grundig.com', logo: 'https://www.google.com/s2/favicons?domain=grundig.com&sz=32' },
      'tefal.com': { name: 'Tefal', domain: 'tefal.com', logo: 'https://www.google.com/s2/favicons?domain=tefal.com&sz=32' },
      'moulinex.com': { name: 'Moulinex', domain: 'moulinex.com', logo: 'https://www.google.com/s2/favicons?domain=moulinex.com&sz=32' },
      'kenwood.com': { name: 'Kenwood', domain: 'kenwood.com', logo: 'https://www.google.com/s2/favicons?domain=kenwood.com&sz=32' },
      'kitchenaid.com': { name: 'KitchenAid', domain: 'kitchenaid.com', logo: 'https://www.google.com/s2/favicons?domain=kitchenaid.com&sz=32' },
      'braun.com': { name: 'Braun', domain: 'braun.com', logo: 'https://www.google.com/s2/favicons?domain=braun.com&sz=32' },
      'remington.com': { name: 'Remington', domain: 'remington.com', logo: 'https://www.google.com/s2/favicons?domain=remington.com&sz=32' }
    };

    //  Correção: aceitar subdomínios (ex: super.continente.pt)
    for (const domain in storeMap) {
      if (hostname.endsWith(domain)) {
        return storeMap[domain];
      }
    }

    // Caso não seja uma loja conhecida
    return {
      name: 'Loja',
      domain: hostname,
      logo: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    };

  } catch (error) {
    console.warn('Erro ao processar URL:', link, error);
    return { name: 'Desconhecida', domain: 'unknown', logo: '/assets/images/default-store.png' };
  }
}
