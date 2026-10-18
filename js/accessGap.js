/* The access-gap score: one 0–100 number per country combining usage, local data centres, connectivity and
   affordability. Pure function of a country record; the weights are the ones quoted in the Access tab. */
export const ACCESS_WEIGHTS = { usage:0.40, dataCentres:0.20, internet:0.20, affordability:0.20 };   // sum to 1
export const DC_CAP = 4;                   // data centres in-country beyond which the score stops rising
export const SUBSCRIPTION_CAP_PCT = 40;    // a $20/month plan costing this share of median income (or more) scores zero for affordability
export function accessScore(c){
  return Math.round(100*(ACCESS_WEIGHTS.usage*c.usageIndex/100 + ACCESS_WEIGHTS.dataCentres*Math.min(1,c.dcCount/DC_CAP) + ACCESS_WEIGHTS.internet*c.internetPenetration + ACCESS_WEIGHTS.affordability*(1-Math.min(1,c.subscriptionShareOfIncome/SUBSCRIPTION_CAP_PCT))));
}
