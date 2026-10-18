/* The data as the app sees it: the three data modules joined into DATA, plus derived fields
   (data-centre counts, access score, continent aggregates) computed once at load. */
import { countries } from "../data/countries.js";
import { datacentres } from "../data/datacentres.js";
import { continents } from "../data/continents.js";
import { PROVIDERS } from "./colors.js";
import { accessScore } from "./accessGap.js";
export const DATA = { countries, datacentres, continents };

/* Global rate for the "prompts since you arrived" ticker (prompts per second, all providers). */
export const PROMPTS_PER_SECOND = 46000;

export const CONTINENTS = ["North America","Europe","Asia","Oceania","South America","Africa"];
export const CONTINENT_CENTROID = {"Africa":[2,20],"Asia":[38,92],"Europe":[52,14],"North America":[42,-100],"South America":[-12,-58],"Oceania":[-26,138]};
export const YEARS = [2022,2023,2024,2025,2026];

/* ---- derived data ---- */
const dcCountByIso = {};
DATA.datacentres.forEach(d => { dcCountByIso[d.iso] = (dcCountByIso[d.iso]||0)+1; });
DATA.countries.forEach(c => { c.dcCount = dcCountByIso[c.iso]||0; c.growthCurve[4] = 1; });
DATA.countries.forEach(c => { c.access = accessScore(c); });
// continent aggregates (population-weighted per-capita usage, share, growth)
export const CONT = {};
CONTINENTS.forEach(k => {
  const cs = DATA.countries.filter(c => c.continent===k);
  const pop = cs.reduce((s,c)=>s+c.population,0);
  const w = cs.reduce((s,c)=>s+c.population*c.usageIndex,0);
  const share = {}; PROVIDERS.forEach(p => share[p]=0);
  const growth = [0,0,0,0,0];
  cs.forEach(c => { PROVIDERS.forEach(p => share[p] += c.providerShare[p]*c.population*c.usageIndex/w); c.growthCurve.forEach((g,i)=> growth[i]+= g*c.population*c.usageIndex/w); });
  CONT[k] = { name:k, continent:k, isContinent:true, lat:CONTINENT_CENTROID[k][0], lon:CONTINENT_CENTROID[k][1],
    usageIndex: w/pop, activeUsers: cs.reduce((s,c)=>s+c.activeUsers,0), population: DATA.continents[k].populationMillions,
    providerShare: share, growthCurve: growth, spend: DATA.continents[k].annualSpendUSD, countries: cs.length,
    dcCount: DATA.datacentres.filter(d => cs.some(c=>c.iso===d.iso)).length };
});
