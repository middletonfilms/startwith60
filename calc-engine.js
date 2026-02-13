/**
 * CALCULATION ENGINE
 * Core business logic for all financial calculations
 * Version controlled and self-documenting
 */

class CalcEngine {
  constructor() {
    this.VERSION = '2/13/2026, 3:38 PM';
    this.data = null;
  }

  /**
   * Initialize engine with data from Excel files
   */
  async init() {
    if (!window.dataLoader) {
      throw new Error('DataLoader not found. Make sure data-loader.js is loaded first.');
    }
    
    this.data = await window.dataLoader.loadAll();
    console.log('CalcEngine initialized with data:', this.data);
  }

  /**
   * Main calculation method
   * Returns organized data structure for visualization
   */
  async calculate(inputs) {
    // Validate required inputs
    if (!inputs.age || !inputs.sex) {
      throw new Error('Age and sex are required');
    }

    // === GLOBAL VARIABLES ===
    const INFLATION = inputs.inflation || 0.0328;
    const INFLATION_MULT = 1 - (INFLATION / (1 + INFLATION));
    const MARKET_GAIN = inputs.marketGain || 0.104;
    const MARKET_MULT = 1 + MARKET_GAIN;
    const RETIREMENT_AGE = inputs.retirementAge || 65;
    const LIFE_EXPECTANCY = inputs.lifeExpectancy || (inputs.sex === 'female' ? 81 : 76);
    const TOBACCO_USER = inputs.tobaccoUser || false;

    // === TIME HORIZONS ===
    const TIME_HORIZON_DEATH = LIFE_EXPECTANCY - inputs.age;
    const TIME_HORIZON_RETIRE = RETIREMENT_AGE - inputs.age;
    const TIME_HORIZON_CUSTOM = inputs.customTimeHorizon || null;
    const ACTIVE_TIME_HORIZON = TIME_HORIZON_CUSTOM || TIME_HORIZON_DEATH;

    // === INSURANCE CALCULATIONS ===
    const rateBrackets = await this.getRateBrackets(inputs.age, inputs.sex);
    const activeBracketIndex = this.getActiveBracket(rateBrackets, inputs.policySize, inputs.monthlyBudget);
    const activeBracket = rateBrackets?.[activeBracketIndex] || null;
    
    const MONTHLY_BUDGET = inputs.monthlyBudget || 
      (inputs.policySize && activeBracket ? (inputs.policySize / 1000) * activeBracket.ratePerThousand : 0);
    const POLICY_SIZE = inputs.policySize || 
      (inputs.monthlyBudget && activeBracket ? (inputs.monthlyBudget / activeBracket.ratePerThousand) * 1000 : 0);
    
    const WHOLE_LIFE_RATE = activeBracket?.ratePerThousand || 0;
    const WHOLE_LIFE_ANNUAL_COST = MONTHLY_BUDGET * 12;
    
    const TERM_POLICY = inputs.termPolicy || null;
    const TERM_BUDGET = inputs.termBudget || 0;
    const TERM_POLICY_SIZE = inputs.termPolicySize || 0;
    const TERM_RATE = 0; // TODO: Calculate from term rate table
    const TERM_ANNUAL_COST = TERM_BUDGET * 12;

    // === MORTALITY ===
    const MORTALITY_LIKELIHOOD = this.getMortalityProbability(inputs.age, inputs.sex, ACTIVE_TIME_HORIZON);

    // === ARRAY CALCULATIONS ===
    const arrays = this.calculateArrays({
      timeHorizon: ACTIVE_TIME_HORIZON,
      monthlyBudget: MONTHLY_BUDGET,
      termBudget: TERM_BUDGET,
      termPolicy: TERM_POLICY,
      marketMult: MARKET_MULT,
      inflationMult: INFLATION_MULT,
      currentAge: inputs.age,
      sex: inputs.sex
    });

    // === FINAL RESULTS ===
    const ACCOUNT_TOTAL = arrays.totalInAccount[arrays.totalInAccount.length - 1];
    const ACCOUNT_TOTAL_ADJUSTED = arrays.totalInAccountAdjusted[arrays.totalInAccountAdjusted.length - 1];
    const ACCOUNT_INCOME = ACCOUNT_TOTAL * MARKET_GAIN;
    const FINAL_YEAR_GROWTH = arrays.marketGainsYear[arrays.marketGainsYear.length - 1];
    const TOTAL_PAID_IN = arrays.paidInTotal[arrays.paidInTotal.length - 1];
    const TOTAL_PAID_IN_ADJUSTED = arrays.paidInTotalAdjusted[arrays.paidInTotalAdjusted.length - 1];
    const TOTAL_MARKET_GAINS = arrays.marketGainsTotal[arrays.marketGainsTotal.length - 1];
    const TOTAL_TERM_COST = arrays.termSetAside.reduce((sum, val) => sum + val, 0);

    // === RETURN ORGANIZED STRUCTURE ===
    return {
      metadata: {
        engineVersion: this.VERSION,
        calculatedAt: new Date().toLocaleString()
      },

      sections: {
        globals: {
          INFLATION,
          INFLATION_MULT,
          MARKET_GAIN,
          MARKET_MULT,
          RETIREMENT_AGE,
          LIFE_EXPECTANCY,
          TOBACCO_USER
        },

        inputs: {
          AGE: inputs.age,
          SEX: inputs.sex,
          MONTHLY_BUDGET,
          POLICY_SIZE,
          TERM_POLICY,
          TERM_BUDGET,
          TERM_POLICY_SIZE
        },

        timeHorizons: {
          TIME_HORIZON_DEATH,
          TIME_HORIZON_RETIRE,
          TIME_HORIZON_CUSTOM,
          ACTIVE_TIME_HORIZON
        },

        insurance: {
          WHOLE_LIFE_RATE,
          WHOLE_LIFE_ANNUAL_COST,
          TERM_RATE,
          TERM_ANNUAL_COST,
          MORTALITY_LIKELIHOOD
        },

        results: {
          ACCOUNT_TOTAL,
          ACCOUNT_TOTAL_ADJUSTED,
          ACCOUNT_INCOME,
          FINAL_YEAR_GROWTH,
          TOTAL_PAID_IN,
          TOTAL_PAID_IN_ADJUSTED,
          TOTAL_MARKET_GAINS,
          TOTAL_TERM_COST
        }
      },

      arrays: arrays,

      tables: {
        rateTable: {
          age: inputs.age,
          sex: inputs.sex,
          brackets: rateBrackets,
          activeBracketIndex: activeBracketIndex
        }
      }
    };
  }

  /**
   * Calculate year-by-year arrays
   */
  calculateArrays(params) {
  const { timeHorizon, monthlyBudget, termBudget, termPolicy, marketMult, inflationMult, currentAge, sex } = params;
  
  const arrays = {
    year: [],
    termSetAside: [],        // MOVED BEFORE payInYear
    payInYear: [],
    inflationValue: [],
    paidInTotal: [],
    payInYearAdjusted: [],
    paidInTotalAdjusted: [],
    marketGainsYear: [],
    marketGainsTotal: [],
    accountIfWindowEnded: [],
    totalInAccount: [],
    totalInAccountAdjusted: [],
    mortalityLikelihood: []
  };

  const annualContribution = monthlyBudget * 12;
  const annualTermCost = termBudget * 12;
  
  // Determine term length (0 if none, 10 if "10 YEAR")
  const termLength = termPolicy === '10 YEAR' ? 10 : 0;

  for (let year = 0; year <= timeHorizon; year++) {
    arrays.year.push(year);
    
    // Term insurance cost (starts at year 0)
    const termCost = (termLength > 0 && year < termLength) ? annualTermCost : 0;
    arrays.termSetAside.push(termCost);
    
    // Pay in year = contribution minus term cost
    const payInYear = annualContribution - termCost;
    arrays.payInYear.push(payInYear);

    arrays.inflationValue.push(Math.pow(inflationMult, year));

    if (year === 0) {
      arrays.paidInTotal.push(payInYear);
      arrays.payInYearAdjusted.push(payInYear);
      arrays.paidInTotalAdjusted.push(payInYear);
      arrays.marketGainsYear.push(0);
      arrays.marketGainsTotal.push(0);
      arrays.accountIfWindowEnded.push(payInYear);
      arrays.totalInAccount.push(payInYear);
      arrays.totalInAccountAdjusted.push(payInYear);
      arrays.mortalityLikelihood.push(null);
    } else {
      arrays.paidInTotal.push(arrays.paidInTotal[year - 1] + payInYear);
      
      const adjustedContribution = payInYear * Math.pow(inflationMult, year);
      arrays.payInYearAdjusted.push(adjustedContribution);
      arrays.paidInTotalAdjusted.push(arrays.paidInTotalAdjusted[year - 1] + adjustedContribution);

      const previousBalance = arrays.totalInAccount[year - 1];
      const gainsThisYear = previousBalance * (marketMult - 1);
      arrays.marketGainsYear.push(gainsThisYear);
      arrays.marketGainsTotal.push(arrays.marketGainsTotal[year - 1] + gainsThisYear);

      const newTotal = previousBalance + gainsThisYear + payInYear;
      arrays.totalInAccount.push(newTotal);
      arrays.totalInAccountAdjusted.push(newTotal * Math.pow(inflationMult, year));

      const noNewContributions = previousBalance + gainsThisYear;
      arrays.accountIfWindowEnded.push(noNewContributions);

      const mortality = this.getMortalityProbability(currentAge, sex, year);
      arrays.mortalityLikelihood.push(mortality);
    }
  }

  return arrays;
}

  /**
   * Get rate brackets for given age and sex
   */
  async getRateBrackets(age, sex) {
    // Load raw rate data
    const rawRateData = await window.dataLoader.loadExcel('RateTables.xlsx', 'LI_RATES');
    
    let ageRow = null;
    for (let i = 4; i < rawRateData.length; i++) {
      if (rawRateData[i][0] === age) {
        ageRow = rawRateData[i];
        break;
      }
    }
    
    if (!ageRow) return null;
    
    const isMinor = age < 18;
    const brackets = [];
    
    if (sex === 'male') {
      brackets.push({
        name: 'Standard',
        range: isMinor ? '$0-$15,099' : '$0-$34,999',
        ratePerThousand: ageRow[1],
        monthlyCutoff: ageRow[2]
      });
      brackets.push({
        name: 'Preferred',
        range: isMinor ? '$15,100-$59,999' : '$35,000-$59,999',
        ratePerThousand: ageRow[5],
        monthlyCutoff: ageRow[6]
      });
      brackets.push({
        name: 'Executive',
        range: isMinor ? '$60,000-$9,999,999' : '$60,000-$119,999',
        ratePerThousand: ageRow[9],
        monthlyCutoff: ageRow[10]
      });
      
      if (isMinor) {
        brackets.push({
          name: 'Select',
          range: '-',
          ratePerThousand: null,
          monthlyCutoff: null
        });
      } else {
        const selectRate = ageRow[13];
        const selectCeiling = ageRow[14];
        const selectCutoff = selectCeiling !== 9999999 ? (selectCeiling / 1000) * selectRate / 12 : null;
        
        brackets.push({
          name: 'Select',
          range: '$120,000-$9,999,999',
          ratePerThousand: selectRate,
          monthlyCutoff: selectCutoff
        });
      }
    } else { // female
      brackets.push({
        name: 'Standard',
        range: isMinor ? '$0-$15,099' : '$0-$34,999',
        ratePerThousand: ageRow[3],
        monthlyCutoff: ageRow[4]
      });
      brackets.push({
        name: 'Preferred',
        range: isMinor ? '$15,100-$59,999' : '$35,000-$59,999',
        ratePerThousand: ageRow[7],
        monthlyCutoff: ageRow[8]
      });
      brackets.push({
        name: 'Executive',
        range: isMinor ? '$60,000-$9,999,999' : '$60,000-$119,999',
        ratePerThousand: ageRow[11],
        monthlyCutoff: ageRow[12]
      });
      
      if (isMinor) {
        brackets.push({
          name: 'Select',
          range: '-',
          ratePerThousand: null,
          monthlyCutoff: null
        });
      } else {
        const selectRate = ageRow[15];
        const selectCeiling = ageRow[16];
        const selectCutoff = selectCeiling !== 9999999 ? (selectCeiling / 1000) * selectRate / 12 : null;
        
        brackets.push({
          name: 'Select',
          range: '$120,000-$9,999,999',
          ratePerThousand: selectRate,
          monthlyCutoff: selectCutoff
        });
      }
    }
    
    return brackets;
  }

  /**
   * Get active bracket index based on policy size or monthly budget
   */
  getActiveBracket(brackets, policySize, monthlyBudget) {
    if (!brackets) return -1;

    if (policySize) {
      if (policySize <= 15099) return 0;
      if (policySize <= 59999) return 1;
      if (policySize <= 119999) return 2;
      return 3;
    } else if (monthlyBudget) {
      for (let i = 0; i < brackets.length; i++) {
        if (brackets[i].monthlyCutoff && monthlyBudget <= brackets[i].monthlyCutoff) {
          return i;
        }
      }
      return brackets.length - 1;
    }

    return -1;
  }

  /**
   * Get CAGR for given percentile and time horizon
   */
  getCAGRForPercentile(percentile, years) {
    if (years > 80) return 10.4;
    
    const history = this.data?.marketHistory;
    if (!history || history.length === 0) return null;
    
    const performances = [];
    for (const entry of history) {
      const growth = entry.growth[years];
      if (growth !== null && growth !== undefined) {
        performances.push(growth);
      }
    }
    
    if (performances.length === 0) return null;
    
    performances.sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * (performances.length - 1));
    const totalGrowth = performances[index];
    
    // Convert total growth to annualized CAGR
    const cagr = Math.pow(totalGrowth, 1/years);
    
    return ((cagr - 1) * 100).toFixed(2);
  }

  /**
   * Get mortality probability for age, sex, years ahead
   */
  getMortalityProbability(age, sex, yearsAhead) {
    if (!this.data?.mortality) return null;
    const mortality = this.data.mortality[sex];
    if (!mortality || !mortality[age]) return null;
    return mortality[age][yearsAhead] || null;
  }
}

// Initialize global instance
async function initCalcEngine() {
  window.calcEngine = new CalcEngine();
  await window.calcEngine.init();
  console.log('CalcEngine ready, version:', window.calcEngine.VERSION);
}

// Expose initialization function
window.initCalcEngine = initCalcEngine;
