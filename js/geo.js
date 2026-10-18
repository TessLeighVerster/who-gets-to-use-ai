/* Country detection without a server, cookies or network. Primary signal: the browser's IANA time zone
   (Intl.DateTimeFormat().resolvedOptions().timeZone) mapped to an ISO 3166-1 alpha-2 code with the table below,
   which covers the zones of every country in data/countries.js. Where one zone serves several countries
   (Africa/Lagos, Africa/Johannesburg, Europe/… links) the most populous country wins. Fallback: the region
   subtag of navigator.language (en-ZA → ZA). Returns null when neither matches a listed country.

   Hosting hook: if the site moves to Cloudflare Pages / Vercel, set GEO_OVERRIDE_URL to an endpoint such as
   "/api/geo" that returns {"country":"ZA"} from the request's geo headers, and call detectCountryAsync()
   instead; the synchronous path stays as the fallback. Nothing here stores anything. */
export const GEO_OVERRIDE_URL = null;   // e.g. "/api/geo" once a server-side geo header is available

const ZONES = {
  US: ["America/New_York","America/Chicago","America/Denver","America/Phoenix","America/Los_Angeles","America/Anchorage","Pacific/Honolulu","America/Detroit","America/Boise","America/Juneau","America/Sitka","America/Nome","America/Adak","America/Metlakatla","America/Menominee","America/Yakutat","America/Indiana/Indianapolis","America/Indiana/Knox","America/Indiana/Marengo","America/Indiana/Petersburg","America/Indiana/Tell_City","America/Indiana/Vevay","America/Indiana/Vincennes","America/Indiana/Winamac","America/Kentucky/Louisville","America/Kentucky/Monticello","America/North_Dakota/Beulah","America/North_Dakota/Center","America/North_Dakota/New_Salem","America/Indianapolis","America/Louisville","US/Eastern","US/Central","US/Mountain","US/Pacific","US/Alaska","US/Hawaii","US/Arizona"],
  CA: ["America/Toronto","America/Vancouver","America/Edmonton","America/Winnipeg","America/Halifax","America/St_Johns","America/Regina","America/Montreal","America/Moncton","America/Whitehorse","America/Yellowknife","America/Iqaluit","America/Rankin_Inlet","America/Dawson","America/Dawson_Creek","America/Fort_Nelson","America/Glace_Bay","America/Goose_Bay","America/Inuvik","America/Cambridge_Bay","America/Swift_Current","America/Atikokan","America/Blanc-Sablon","America/Creston","America/Resolute","America/Nipigon","America/Thunder_Bay","America/Rainy_River","America/Pangnirtung","Canada/Eastern","Canada/Central","Canada/Mountain","Canada/Pacific","Canada/Atlantic","Canada/Newfoundland"],
  MX: ["America/Mexico_City","America/Cancun","America/Merida","America/Monterrey","America/Matamoros","America/Chihuahua","America/Ciudad_Juarez","America/Ojinaga","America/Mazatlan","America/Bahia_Banderas","America/Hermosillo","America/Tijuana","America/Ensenada","America/Santa_Isabel"],
  BR: ["America/Sao_Paulo","America/Manaus","America/Fortaleza","America/Recife","America/Bahia","America/Belem","America/Araguaina","America/Maceio","America/Campo_Grande","America/Cuiaba","America/Santarem","America/Porto_Velho","America/Boa_Vista","America/Rio_Branco","America/Eirunepe","America/Noronha","Brazil/East","Brazil/West"],
  AR: ["America/Argentina/Buenos_Aires","America/Argentina/Cordoba","America/Argentina/Salta","America/Argentina/Jujuy","America/Argentina/Tucuman","America/Argentina/Catamarca","America/Argentina/La_Rioja","America/Argentina/San_Juan","America/Argentina/Mendoza","America/Argentina/San_Luis","America/Argentina/Rio_Gallegos","America/Argentina/Ushuaia","America/Buenos_Aires","America/Cordoba","America/Mendoza"],
  CL: ["America/Santiago","America/Punta_Arenas","Pacific/Easter","Chile/Continental"],
  CO: ["America/Bogota"], PE: ["America/Lima"], VE: ["America/Caracas"],
  GB: ["Europe/London","Europe/Belfast","GB","GB-Eire"], DE: ["Europe/Berlin","Europe/Busingen"], FR: ["Europe/Paris"], NL: ["Europe/Amsterdam"],
  SE: ["Europe/Stockholm"], NO: ["Europe/Oslo","Arctic/Longyearbyen"], FI: ["Europe/Helsinki","Europe/Mariehamn"], DK: ["Europe/Copenhagen"], IE: ["Europe/Dublin","Eire"],
  CH: ["Europe/Zurich"], ES: ["Europe/Madrid","Africa/Ceuta","Atlantic/Canary"], IT: ["Europe/Rome"], PL: ["Europe/Warsaw","Poland"], PT: ["Europe/Lisbon","Atlantic/Madeira","Atlantic/Azores","Portugal"],
  UA: ["Europe/Kyiv","Europe/Kiev","Europe/Zaporozhye","Europe/Uzhgorod","Europe/Simferopol"],
  RU: ["Europe/Moscow","Europe/Kaliningrad","Europe/Samara","Europe/Volgograd","Europe/Saratov","Europe/Ulyanovsk","Europe/Astrakhan","Europe/Kirov","Asia/Yekaterinburg","Asia/Omsk","Asia/Novosibirsk","Asia/Barnaul","Asia/Tomsk","Asia/Novokuznetsk","Asia/Krasnoyarsk","Asia/Irkutsk","Asia/Chita","Asia/Yakutsk","Asia/Khandyga","Asia/Vladivostok","Asia/Ust-Nera","Asia/Magadan","Asia/Sakhalin","Asia/Srednekolymsk","Asia/Kamchatka","Asia/Anadyr","W-SU"],
  CN: ["Asia/Shanghai","Asia/Urumqi","Asia/Chongqing","Asia/Chungking","Asia/Harbin","Asia/Kashgar","PRC"],
  JP: ["Asia/Tokyo","Japan"], KR: ["Asia/Seoul","ROK"], SG: ["Asia/Singapore","Singapore"], IN: ["Asia/Kolkata","Asia/Calcutta"],
  ID: ["Asia/Jakarta","Asia/Makassar","Asia/Jayapura","Asia/Pontianak","Asia/Ujung_Pandang"], VN: ["Asia/Ho_Chi_Minh","Asia/Saigon"], PH: ["Asia/Manila"], TH: ["Asia/Bangkok"],
  MY: ["Asia/Kuala_Lumpur","Asia/Kuching"], PK: ["Asia/Karachi"], BD: ["Asia/Dhaka","Asia/Dacca"], NP: ["Asia/Kathmandu","Asia/Katmandu"], LK: ["Asia/Colombo"],
  AE: ["Asia/Dubai"], SA: ["Asia/Riyadh"], IL: ["Asia/Jerusalem","Asia/Tel_Aviv","Israel"], TR: ["Europe/Istanbul","Asia/Istanbul","Turkey"], IR: ["Asia/Tehran","Iran"],
  KZ: ["Asia/Almaty","Asia/Qyzylorda","Asia/Qostanay","Asia/Aqtobe","Asia/Aqtau","Asia/Atyrau","Asia/Oral"], TW: ["Asia/Taipei","ROC"],
  NG: ["Africa/Lagos"], ZA: ["Africa/Johannesburg"], KE: ["Africa/Nairobi"], EG: ["Africa/Cairo","Egypt"], ET: ["Africa/Addis_Ababa"], GH: ["Africa/Accra"],
  MA: ["Africa/Casablanca","Africa/El_Aaiun"], TZ: ["Africa/Dar_es_Salaam"], CD: ["Africa/Kinshasa","Africa/Lubumbashi"], DZ: ["Africa/Algiers"], UG: ["Africa/Kampala"],
  SN: ["Africa/Dakar"], RW: ["Africa/Kigali"], TN: ["Africa/Tunis"],
  AU: ["Australia/Sydney","Australia/Melbourne","Australia/Brisbane","Australia/Perth","Australia/Adelaide","Australia/Hobart","Australia/Darwin","Australia/Canberra","Australia/Broken_Hill","Australia/Lindeman","Australia/Lord_Howe","Australia/Eucla","Australia/Currie","Australia/ACT","Australia/NSW","Australia/Queensland","Australia/South","Australia/Tasmania","Australia/Victoria","Australia/West","Australia/North"],
  NZ: ["Pacific/Auckland","Pacific/Chatham","NZ","NZ-CHAT"],
};
const ZONE_TO_ISO = {};
for (const [iso, zones] of Object.entries(ZONES)) for (const z of zones) ZONE_TO_ISO[z] = iso;

export function countryFromTimeZone(tz){ return (tz && ZONE_TO_ISO[tz]) || null; }
export function countryFromLanguage(lang){ const m = /^[a-z]{2,3}[-_]([A-Z]{2})\b/i.exec(lang || ""); return m ? m[1].toUpperCase() : null; }

/* Synchronous detection. `listed` is the set of ISO codes the exhibit knows; anything else returns null. */
export function detectCountry(listed){
  const ok = iso => iso && (!listed || listed.has(iso)) ? iso : null;
  let tz = null; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) {}
  const byZone = ok(countryFromTimeZone(tz)); if (byZone) return byZone;
  for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])){ const r = ok(countryFromLanguage(l)); if (r) return r; }
  return null;
}

/* Hook for a server override (see GEO_OVERRIDE_URL). Not used while the site is on GitHub Pages. */
export async function detectCountryAsync(listed){
  if (GEO_OVERRIDE_URL){ try { const r = await fetch(GEO_OVERRIDE_URL, { cache: "no-store" }); const j = await r.json(); const iso = String(j.country || "").toUpperCase(); if (iso && (!listed || listed.has(iso))) return iso; } catch (_) {} }
  return detectCountry(listed);
}
