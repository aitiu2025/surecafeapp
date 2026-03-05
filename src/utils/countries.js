/**
 * Fallback country-state data used when the country-state-city library is unavailable.
 */
export const FALLBACK_COUNTRY_STATE_MAP = {
  'United States': [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
    'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
    'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
    'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
  ],
  'Canada': [
    'Alberta','British Columbia','Manitoba','New Brunswick',
    'Newfoundland and Labrador','Northwest Territories','Nova Scotia',
    'Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon',
  ],
  'India': [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
    'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
    'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
    'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
    'Uttar Pradesh','Uttarakhand','West Bengal',
  ],
  'United Kingdom': ['England','Scotland','Wales','Northern Ireland'],
  'Australia': [
    'New South Wales','Queensland','South Australia','Tasmania',
    'Victoria','Western Australia','Australian Capital Territory','Northern Territory',
  ],
  'Germany': [
    'Baden-Württemberg','Bavaria','Berlin','Brandenburg','Bremen','Hamburg',
    'Hesse','Lower Saxony','Mecklenburg-Vorpommern','North Rhine-Westphalia',
    'Rhineland-Palatinate','Saarland','Saxony','Saxony-Anhalt',
    'Schleswig-Holstein','Thuringia',
  ],
  'France': [
    'Île-de-France',"Provence-Alpes-Côte d'Azur",'Auvergne-Rhône-Alpes',
    'Normandy','Brittany','Grand Est','Bourgogne-Franche-Comté',
    'Centre-Val de Loire','Corsica','Hauts-de-France','New Aquitaine',
    'Occitanie','Pays de la Loire',
  ],
  'Japan': [
    'Hokkaido','Aomori','Iwate','Miyagi','Akita','Yamagata','Fukushima',
    'Ibaraki','Tochigi','Gunma','Saitama','Chiba','Tokyo','Kanagawa',
    'Niigata','Toyama','Ishikawa','Fukui','Yamanashi','Nagano','Gifu',
    'Shizuoka','Aichi','Mie','Shiga','Kyoto','Osaka','Hyogo','Nara',
    'Wakayama','Tottori','Shimane','Okayama','Hiroshima','Yamaguchi',
    'Tokushima','Kagawa','Ehime','Kochi','Fukuoka','Saga','Nagasaki',
    'Kumamoto','Oita','Miyazaki','Kagoshima','Okinawa',
  ],
};

/**
 * Returns sorted list of country names.
 */
export function getCountryList() {
  return Object.keys(FALLBACK_COUNTRY_STATE_MAP).sort();
}

/**
 * Returns sorted list of states for a given country name.
 * @param {string} country
 * @returns {string[]}
 */
export function getStatesForCountry(country) {
  return (FALLBACK_COUNTRY_STATE_MAP[country] || []).slice().sort();
}

/**
 * Returns all unique states across all countries, sorted.
 * @returns {string[]}
 */
export function getAllStates() {
  const stateSet = new Set();
  Object.values(FALLBACK_COUNTRY_STATE_MAP).forEach(states => {
    states.forEach(s => stateSet.add(s));
  });
  return Array.from(stateSet).sort();
}
