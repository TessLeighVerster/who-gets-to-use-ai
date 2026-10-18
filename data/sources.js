/** Where the numbers come from. Every provenance object in data/countries.js carries a `source` key into this table.
 *  `terms` is a short note on the licence; data/raw/LICENSES.md has the detail. */
export const SOURCES = {
  "worldbank-it-net-user-zs": { publisher:"World Bank (ITU series)", name:"Individuals using the Internet (% of population)", series:"IT.NET.USER.ZS",
    url:"https://data.worldbank.org/indicator/IT.NET.USER.ZS", api:"https://api.worldbank.org/v2/country/all/indicator/IT.NET.USER.ZS?format=json", terms:"CC BY 4.0", retrieved:"2026-10-18" },
  "worldbank-eg-elc-accs-zs": { publisher:"World Bank (SDG 7 tracking)", name:"Access to electricity (% of population)", series:"EG.ELC.ACCS.ZS",
    url:"https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS", api:"https://api.worldbank.org/v2/country/all/indicator/EG.ELC.ACCS.ZS?format=json", terms:"CC BY 4.0", retrieved:"2026-10-18" },
  "worldbank-ny-gdp-pcap-cd": { publisher:"World Bank", name:"GDP per capita (current US$)", series:"NY.GDP.PCAP.CD",
    url:"https://data.worldbank.org/indicator/NY.GDP.PCAP.CD", api:"https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json", terms:"CC BY 4.0", retrieved:"2026-10-18" },
  "worldbank-sp-pop-totl": { publisher:"World Bank", name:"Population, total", series:"SP.POP.TOTL",
    url:"https://data.worldbank.org/indicator/SP.POP.TOTL", api:"https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json", terms:"CC BY 4.0", retrieved:"2026-10-18" },
  "cable-mobile-data-pricing-2023": { publisher:"Cable.co.uk", name:"Worldwide Mobile Data Pricing 2023: average price of 1GB (USD)", series:"worldwide_mobile_data_pricing_data.xlsx (2023 release, rates frozen 7 Sep 2023)",
    url:"https://www.cable.co.uk/mobiles/worldwide-data-pricing/", file:"https://540k006f.tinifycdn.com/mobiles/worldwide-data-pricing/2023/worldwide_mobile_data_pricing_data.xlsx",
    terms:"Site terms reserve all rights; published for citation with attribution. Raw file is not committed (see data/raw/LICENSES.md).", retrieved:"2026-10-18" },
  "anthropic-economic-index-2026-06-26": { publisher:"Anthropic", name:"Anthropic Economic Index: usage_per_capita_index by country (Claude.ai Free, Pro and Max), latest month per country", series:"release_2026_06_26/data/aei_claude_ai_2026-06-26.csv",
    url:"https://huggingface.co/datasets/Anthropic/EconomicIndex/tree/main/release_2026_06_26", terms:"CC BY 4.0 (data), MIT (code)", retrieved:"2026-10-18",
    note:"A Claude-usage proxy, not all-AI usage. Usage share divided by working-age population share; rescaled here so the top listed country = 100." },
  "derived": { publisher:"this repository", name:"Computed from other fields in the same record", url:"https://github.com/TessLeighVerster/who-gets-to-use-ai", terms:"n/a" },
  "model": { publisher:"this repository", name:"Illustrative estimate modelled from public sources (not a measured series)", url:"https://github.com/TessLeighVerster/who-gets-to-use-ai", terms:"n/a" }
};
