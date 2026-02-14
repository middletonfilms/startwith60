// Load Excel files
const rateTables = await window.dataLoader.loadExcel('RateTables.xlsx', 'LI_RATES');
const mortality = await window.dataLoader.loadExcel('Mortality.xlsx', 'Mortality');
const marketHistory = await window.dataLoader.loadExcel('MarketHistory.xlsx', 'Market');

// Your code here:
let market_Avg = .104
let market_AvgMult = 1.104
let inf_Avg = .0328
let inf_AvgMult = 1-(inf_Avg/(1+inf_Avg))
let retireAge_Avg = 65
let deathAgeM_Avg = 76
let deathAgeF_Avg = 81

function formatCurrency(number, decimals = 0) {
  return '$' + number.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
