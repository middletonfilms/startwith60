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

const round = (num,digits=0) => parseFloat(num.toFixed(digits));

function columnsTo2D(columns) {
  const keys = Object.keys(columns);
  const length = columns[keys[0]].length;
  const array = [keys]; // Header row first!
  
  for (let i = 0; i < length; i++) {
    const row = keys.map(key => columns[key][i]);
    array.push(row);
  }
  
  return array;
}

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

function generateProjectionArrays(inputs) {
  const {
    timeHorizon,
    age,
    sex,
    monthlyBudget,
    termBudget = 0,
    termLength = 0,
    marketMult = 1.104,
    inflationMult = 0.968241673
  } = inputs;
  
  const annualBudget = monthlyBudget * 12;
  const annualTermCost = termBudget * 12;
  
  // Initialize all columns
  const columns = {
    year: [],
    age: [],
    '$termSetAside': [],
    '$payInYear': [],
    inflationValue: [],
    '$paidInTotal': [],
    '$payInYearAdjusted': [],
    '$paidInTotalAdjusted': [],
    '$marketGainsYear': [],
    '$marketGainsTotal': [],
    '$accountIfWindowEnded': [],
    '$totalInAccount': [],
    '$totalInAccountAdjusted': [],
    mortalityLikelihood: []
  };
  
  // Calculate each year
  for (let year = 0; year <= timeHorizon; year++) {
    columns.year.push(year);
    columns.age.push(age + year);
    
    const termCost = (year < termLength) ? annualTermCost : 0;
    columns['$termSetAside'].push(termCost);
    
    const payIn = annualBudget - termCost;
    columns['$payInYear'].push(payIn);
    
    const infValue = Math.pow(inflationMult, year);
    columns.inflationValue.push(infValue);
    
    const mort = mortality?.[sex]?.[age]?.[year] || null;
    
    if (year === 0) {
      columns['$paidInTotal'].push(payIn);
      columns['$payInYearAdjusted'].push(payIn);
      columns['$paidInTotalAdjusted'].push(payIn);
      columns['$marketGainsYear'].push(0);
      columns['$marketGainsTotal'].push(0);
      columns['$accountIfWindowEnded'].push(payIn);
      columns['$totalInAccount'].push(payIn);
      columns['$totalInAccountAdjusted'].push(payIn);
      columns.mortalityLikelihood.push(null);
    } else {
      const prevTotal = columns['$totalInAccount'][year - 1];
      
      columns['$paidInTotal'].push(columns['$paidInTotal'][year - 1] + payIn);
      
      const adjPayIn = payIn * infValue;
      columns['$payInYearAdjusted'].push(adjPayIn);
      columns['$paidInTotalAdjusted'].push(columns['$paidInTotalAdjusted'][year - 1] + adjPayIn);
      
      const gains = prevTotal * (marketMult - 1);
      columns['$marketGainsYear'].push(gains);
      columns['$marketGainsTotal'].push(columns['$marketGainsTotal'][year - 1] + gains);
      
      const windowEnded = prevTotal + gains;
      columns['$accountIfWindowEnded'].push(windowEnded);
      
      const newTotal = prevTotal + gains + payIn;
      columns['$totalInAccount'].push(newTotal);
      columns['$totalInAccountAdjusted'].push(newTotal * infValue);
      
      columns.mortalityLikelihood.push(mort);
    }
  }
  
  return columns;
}

function calculateBreakEven(projectionArrays, deathBenefit) {
  for (let year = 0; year < projectionArrays['$accountIfWindowEnded'].length; year++) {
    const accountValue = projectionArrays['$accountIfWindowEnded'][year];
    
    if (accountValue > deathBenefit) {
      return {
        year: year,
        age: projectionArrays.age[year]
      };
    }
  }
  
  // If never breaks even
  return null;
}



function calculateEndingGrowth(cutoffYear, ...additionalYears) {
  const prevYear = result['$totalInAccount'][cutoffYear - 1];
  const currentYear = result['$accountIfWindowEnded'][cutoffYear];
  
  const results = {
    day: round(currentYear - (prevYear * Math.pow(marketMult, 364/365)),2),
    week: round(currentYear - (prevYear * Math.pow(marketMult, 51/52)),2),
    month: round(currentYear - (prevYear * Math.pow(marketMult, 11/12)),2),
    year: round(currentYear - prevYear,2)
  };
  
  additionalYears.forEach(years => {
    const startYear = cutoffYear - years;
    if (startYear >= 0) {
      results[`last${years}Years`] = round(currentYear - result['$accountIfWindowEnded'][startYear],2);
    }
  });
  
  return results;
}

