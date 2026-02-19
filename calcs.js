// Load Excel files
const rateTables = await window.dataLoader.loadExcel('RateTables.xlsx', 'LI_RATES');
const mortality = await window.dataLoader.loadExcel('Mortality.xlsx', 'Mortality');
const marketHistory = await window.dataLoader.loadExcel('MarketHistory.xlsx', 'Market');

// Your code here:
const market_Avg = .104
const market_AvgMult = 1.104
const inf_Avg = .0328
const inf_AvgMult = 1-(inf_Avg/(1+inf_Avg))
const retireAge_Avg = 65
const deathAgeM_Avg = 76
const deathAgeF_Avg = 81

function formatCurrency(number, decimals = 0) {
  return '$' + number.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
function getMortalityArray(age, sex, timeHzn) {
  const slice = mortality[sex]?.[age];
  if (!slice) return null;
  
  const array = [null]; // Index 0 = null (no value for year 0)
  
  for (let year = 1; year <= timeHzn; year++) {
    array.push(slice[year] || null);
  }
  
  return array;
}

function inf_Calc(inf) {
  return 1 - (inf / (1 + inf));
}

