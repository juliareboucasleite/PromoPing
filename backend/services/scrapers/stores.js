export const stores = [
  // 🛒 SUPERMERCADOS
  {
    name: "Continente",
    domain: "continente.pt",
    selectors: {
      name: "h1",
      price: [".ct-price-formatted", ".pwc-price__main"],
    },
  },
  {
    name: "Pingo Doce",
    domain: "pingodoce.pt",
    selectors: {
      name: "h1",
      price: [".product-price", ".price-tag"],
    },
  },
  {
    name: "Auchan",
    domain: "auchan.pt",
    selectors: {
      name: "h1",
      price: [".product-price-value", ".sales-price"],
    },
  },
  {
    name: "Lidl",
    domain: "lidl.pt",
    selectors: {
      name: "h1",
      price: [".pricebox__price", ".m-price__price"],
    },
  },
  {
    name: "Aldi",
    domain: "aldi.pt",
    selectors: {
      name: "h1",
      price: [".price", ".product-price"],
    },
  },

  // 💻 ELETRÓNICA
 {
  name: "FNAC",
  domain: "fnac.pt",
  selectors: {
    name: "h1",
    price: [".f-priceBox-price", ".price", "[itemprop='price']", ".userPrice"]
  },
},
{
  name: "Worten",
  domain: "worten.pt",
  selectors: {
    name: "h1",
    price: [".w-product-price", ".price-value", "[itemprop='price']", ".sales-price"]
  },
},

  {
    name: "MediaMarkt",
    domain: "mediamarkt.pt",
    selectors: {
      name: "h1",
      price: [".price", ".PriceBox-price"],
    },
  },
  {
    name: "Rádio Popular",
    domain: "radiopopular.pt",
    selectors: {
      name: "h1",
      price: [".price", ".value"],
    },
  },

  // 🏠 CASA E BRICOLAGE
  {
    name: "IKEA",
    domain: "ikea.com",
    selectors: {
      name: "h1",
      price: [".pip-temp-price__integer", ".pip-temp-price__sr-value"],
    },
  },
  {
    name: "Leroy Merlin",
    domain: "leroymerlin.pt",
    selectors: {
      name: "h1",
      price: [".price", ".product-price"],
    },
  },

  // 🔄 fallback
  {
    name: "Desconhecida",
    domain: "",
    selectors: {
      name: "h1",
      price: [".price"],
    },
  },
];
