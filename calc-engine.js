/**
 * CALCULATION ENGINE
 * Pure calculation logic - no UI
 * Takes user inputs, returns ALL variables and arrays
 */

class CalcEngine {
  constructor(data) {
    this.data = data; // rateTables, mortality, marketHistory from dataLoader
  }

  /**
   * Main calculation function
   * @param {Object} inputs - User inputs
   * @returns {Object} All variables, arrays, and results
   */
  calculate(inputs) {
    // === GLOBAL VARIABLES (with defaults) ===
    const INFLATION = inputs.inflation ?? 0.0328;
    const INFLATION_MULT = 1 - (INFLATION / (1 + INFLATION));
    const MARKET_GAIN = inputs.marketGain ?? 0.104;
    const MARKET_MULT = 1 + MARKET_GAIN;
    const RETIREMENT_AGE = inputs.retirementAge ?? 65;
    const LIFE_EXPECTANCY = inputs.lifeExpectancy ?? (inputs.sex === 'female' ? 81 : 76);
    const TOBACCO_USER = inputs.tobaccoUser ?? false;

    // === REQUIRED USER INPUTS ===
    const AGE = inputs.age;
    const SEX = inputs.sex; // 'male' or 'female'
    const MONTHLY_BUDGET = inputs.monthlyBudget;
    const POLICY_SIZE = inputs.policySize;
    
    // === OPTIONAL INPUTS ===
    const TERM_POLICY = inputs.termPolicy ?? null;
    const TERM_BUDGET = inputs.termBudget ?? 0;
    const TERM_POLICY_SIZE = inputs.termPolicySize ?? 0;
    const PERFORMANCE_PERCENTILE = inputs.performancePercentile ?? null;
    
    // === CUSTOM TIME HORIZONS ===
    const CUSTOM_TIME_HORIZON = inputs.customTimeHorizon ?? null;

    // === CALCULATED TIME HORIZONS ===
    const TIME_HORIZON_DEATH = LIFE_EXPECTANCY - AGE;
    const TIME_HORIZON_RETIRE = RETIREMENT_AGE - AGE;
    const ACTIVE_TIME_HORIZON = CUSTOM_TIME_HORIZON ?? TIME_HORIZON_DEATH;

    // === TIME HORIZON ARRAY (0 to ACTIVE_TIME_HORIZON inclusive) ===
    const TIME_HORIZON_ARRAY = Array.from(
      { length: ACTIVE_TIME_HORIZON + 1 }, 
      (_, i) => i
    );

    // === ANNUAL BUDGET ===
    const ANNUAL_BUDGET = MONTHLY_BUDGET * 12;

    // === DEVELOPER-FRIENDLY ARRAY NAMES ===
    
    // inflationValue = $1 buying power after N years of inflation
    const inflationValue = TIME_HORIZON_ARRAY.map(year => 
      Math.pow(INFLATION_MULT, year)
    );

    // termSetAside = Money set aside for term insurance each year
    const termSetAside = TIME_HORIZON_ARRAY.map(year => {
      if (TERM_POLICY && year < TERM_POLICY && year > 0) {
        return TERM_BUDGET * 12; // Convert monthly to annual
      }
      return 0;
    });

    // payInYear = Annual contribution each year (constant)
    const payInYear = TIME_HORIZON_ARRAY.map(() => ANNUAL_BUDGET);

    // paidInTotal = Cumulative contributions over time
    const paidInTotal = [];
    let cumulativePayIn = 0;
    for (let i = 0; i < TIME_HORIZON_ARRAY.length; i++) {
      cumulativePayIn += payInYear[i];
      paidInTotal.push(cumulativePayIn);
    }

    // payInYearAdjusted = Annual contribution adjusted for inflation
    const payInYearAdjusted = payInYear.map((contribution, year) =>
      contribution * Math.pow(INFLATION_MULT, year)
    );

    // paidInTotalAdjusted = Cumulative inflation-adjusted contributions
    const paidInTotalAdjusted = [];
    let cumulativePayInAdj = 0;
    for (let i = 0; i < TIME_HORIZON_ARRAY.length; i++) {
      cumulativePayInAdj += payInYearAdjusted[i];
      paidInTotalAdjusted.push(cumulativePayInAdj);
    }

    // marketGainsYear = Market gains THIS year (from previous balance)
    // marketGainsTotal = Cumulative market gains over all years
    // accountIfWindowEnded = What account would be worth if cashed out (no new contributions)
    // totalInAccount = Running account total with contributions
    // totalInAccountAdjusted = Account total adjusted for inflation
    
    const marketGainsYear = [];
    const marketGainsTotal = [];
    const accountIfWindowEnded = [];
    const totalInAccount = [];
    const totalInAccountAdjusted = [];
    
    let runningTotal = 0;
    let cumulativeGains = 0;
    
    for (let i = 0; i < TIME_HORIZON_ARRAY.length; i++) {
      const contribution = payInYear[i];
      const termCost = termSetAside[i];
      
      if (i === 0) {
        // Year 0: Just the contribution (no growth yet)
        runningTotal = contribution - termCost;
        marketGainsYear.push(null); // No gains first year
        marketGainsTotal.push(null);
        accountIfWindowEnded.push(null);
      } else {
        // Calculate gains from previous year's balance
        const gainsThisYear = runningTotal * MARKET_GAIN;
        cumulativeGains += gainsThisYear;
        
        marketGainsYear.push(gainsThisYear);
        marketGainsTotal.push(cumulativeGains);
        
        // Account if window ended = previous total + gains (no new contribution)
        accountIfWindowEnded.push(runningTotal + gainsThisYear);
        
        // Add contribution and gains, subtract term cost
        runningTotal = runningTotal + gainsThisYear + contribution - termCost;
      }
      
      totalInAccount.push(runningTotal);
      
      // Adjust for inflation
      const inflationAdjusted = runningTotal * inflationValue[i];
      totalInAccountAdjusted.push(inflationAdjusted);
    }

    // === FINAL METRICS ===
    const ACCOUNT_TOTAL = totalInAccount[totalInAccount.length - 1];
    const ACCOUNT_TOTAL_ADJUSTED = totalInAccountAdjusted[totalInAccountAdjusted.length - 1];
    const ACCOUNT_INCOME = ACCOUNT_TOTAL * MARKET_GAIN;
    const FINAL_YEAR_GROWTH = totalInAccount[totalInAccount.length - 1] - (totalInAccount[totalInAccount.length - 2] || 0);
    const TOTAL_PAID_IN = paidInTotal[paidInTotal.length - 1];
    const TOTAL_PAID_IN_ADJUSTED = paidInTotalAdjusted[paidInTotalAdjusted.length - 1];
    const TOTAL_MARKET_GAINS = marketGainsTotal[marketGainsTotal.length - 1] || 0;
    const TOTAL_TERM_COST = termSetAside.reduce((sum, val) => sum + val, 0);

    // === MORTALITY LOOKUP ===
    const MORTALITY_LIKELIHOOD = this._getMortalityProbability(
      AGE, 
      SEX, 
      ACTIVE_TIME_HORIZON
    );

    // === MARKET PERFORMANCE LOOKUP (if percentile specified) ===
    let MARKET_PERFORMANCE_OVERRIDE = null;
    if (PERFORMANCE_PERCENTILE !== null) {
      MARKET_PERFORMANCE_OVERRIDE = this._getMarketPerformance(
        ACTIVE_TIME_HORIZON,
        PERFORMANCE_PERCENTILE
      );
    }

    // === RATE TABLE LOOKUPS ===
    const WHOLE_LIFE_RATE = this._getInsuranceRate(AGE, SEX, TOBACCO_USER, 'whole');
    const TERM_RATE = TERM_POLICY ? this._getInsuranceRate(AGE, SEX, TOBACCO_USER, 'term') : null;

    // Calculate actual insurance costs if policy sizes are known
    const WHOLE_LIFE_ANNUAL_COST = POLICY_SIZE && WHOLE_LIFE_RATE 
      ? (POLICY_SIZE / 1000) * WHOLE_LIFE_RATE * 12
      : null;
    
    const TERM_ANNUAL_COST = TERM_POLICY_SIZE && TERM_RATE
      ? (TERM_POLICY_SIZE / 1000) * TERM_RATE * 12
      : null;

    // === RETURN ALL VARIABLES ===
    return {
      // Global variables
      globals: {
        INFLATION,
        INFLATION_MULT,
        MARKET_GAIN,
        MARKET_MULT,
        RETIREMENT_AGE,
        LIFE_EXPECTANCY,
        TOBACCO_USER
      },
      
      // User inputs
      inputs: {
        AGE,
        SEX,
        MONTHLY_BUDGET,
        POLICY_SIZE,
        TERM_POLICY,
        TERM_BUDGET,
        TERM_POLICY_SIZE,
        PERFORMANCE_PERCENTILE,
        CUSTOM_TIME_HORIZON
      },
      
      // Time horizons
      timeHorizons: {
        TIME_HORIZON_DEATH,
        TIME_HORIZON_RETIRE,
        ACTIVE_TIME_HORIZON
      },
      
      // Arrays (developer-friendly names matching Excel columns)
      arrays: {
        year: TIME_HORIZON_ARRAY,
        inflationValue: inflationValue,
        marketGainsYear: marketGainsYear,
        marketGainsTotal: marketGainsTotal,
        accountIfWindowEnded: accountIfWindowEnded,
        termSetAside: termSetAside,
        payInYear: payInYear,
        paidInTotal: paidInTotal,
        payInYearAdjusted: payInYearAdjusted,
        paidInTotalAdjusted: paidInTotalAdjusted,
        totalInAccount: totalInAccount,
        totalInAccountAdjusted: totalInAccountAdjusted
      },
      
      // Final results
      results: {
        ACCOUNT_TOTAL,
        ACCOUNT_TOTAL_ADJUSTED,
        ACCOUNT_INCOME,
        FINAL_YEAR_GROWTH,
        TOTAL_PAID_IN,
        TOTAL_PAID_IN_ADJUSTED,
        TOTAL_MARKET_GAINS,
        TOTAL_TERM_COST,
        MORTALITY_LIKELIHOOD,
        MARKET_PERFORMANCE_OVERRIDE
      },
      
      // Insurance rates
      insurance: {
        WHOLE_LIFE_RATE,
        TERM_RATE,
        WHOLE_LIFE_ANNUAL_COST,
        TERM_ANNUAL_COST
      }
    };
  }

  /**
   * Look up mortality probability
   */
  _getMortalityProbability(age, sex, years) {
    if (!this.data.mortality || !this.data.mortality[sex]) {
      return null;
    }
    
    const ageData = this.data.mortality[sex][age];
    if (!ageData) return null;
    
    return ageData[years] ?? null;
  }

  /**
   * Look up historical market performance at given percentile
   */
  _getMarketPerformance(years, percentile) {
    if (!this.data.marketHistory) return null;
    
    // Find all periods matching this time horizon
    const performances = [];
    
    for (const entry of this.data.marketHistory) {
      const growth = entry.growth[years];
      if (growth !== null && growth !== undefined) {
        performances.push(growth);
      }
    }
    
    if (performances.length === 0) return null;
    
    // Sort and find percentile
    performances.sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * performances.length);
    
    return performances[index];
  }

  /**
   * Look up insurance rate from rate table
   */
  _getInsuranceRate(age, sex, tobacco, type) {
    if (!this.data.rateTables || !this.data.rateTables[age]) {
      return null;
    }
    
    const ageRates = this.data.rateTables[age];
    
    // TODO: Add tobacco user logic when rate table structure is clear
    // For now, return basic rate
    return ageRates[sex] ?? null;
  }

  /**
   * Calculate comparison: Whole Life vs Index Fund
   */
  compareWholeLifeVsIndex(inputs) {
    // Scenario 1: Money goes to whole life insurance
    const wholeLifeResult = this.calculate({
      ...inputs,
      monthlyBudget: 0, // No investing, all to insurance
      policySize: inputs.policySize
    });
    
    // Scenario 2: Money goes to index fund
    const indexResult = this.calculate({
      ...inputs,
      monthlyBudget: inputs.monthlyBudget,
      policySize: 0 // No insurance
    });
    
    return {
      wholeLif: wholeLifeResult,
      index: indexResult,
      comparison: {
        indexAdvantage: indexResult.results.ACCOUNT_TOTAL - (inputs.policySize || 0),
        theyKeep: indexResult.results.ACCOUNT_TOTAL - (inputs.policySize || 0)
      }
    };
  }
}

// Create global instance once data is loaded
window.calcEngine = null;

// Initialize when data is ready
async function initCalcEngine() {
  if (!window.dataLoader) {
    throw new Error('dataLoader not found. Include data-loader.js first.');
  }
  
  const data = await window.dataLoader.loadAll();
  window.calcEngine = new CalcEngine(data);
  
  return window.calcEngine;
}

// Make initCalcEngine globally available
if (typeof window !== 'undefined') {
  window.initCalcEngine = initCalcEngine;
}
