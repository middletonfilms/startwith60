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

    // payIn = Annual contribution before any adjustments
    const payIn = TIME_HORIZON_ARRAY.map(year => ANNUAL_BUDGET);

    // termSetAside = Money set aside for term insurance each year
    const termSetAside = TIME_HORIZON_ARRAY.map(year => {
      // If term policy exists and this year is within term period
      if (TERM_POLICY && year < TERM_POLICY) {
        return TERM_BUDGET * 12; // Convert monthly to annual
      }
      return 0;
    });

    // payInAdjusted = Annual contribution adjusted for inflation
    // Formula: PAY IN * (INFLATION_MULT ^ year)
    const payInAdjusted = payIn.map((contribution, year) =>
      contribution * Math.pow(INFLATION_MULT, year)
    );

    // marketGains = Gains from previous year's total (NOT including current contribution)
    // Formula: Previous total * MARKET_GAIN
    const marketGains = [];
    
    // accountTotal = Running total in account after contribution and growth
    // Year 0: Just the contribution
    // Year N: (Previous total + current contribution - term cost) * MARKET_MULT
    const accountTotal = [];
    
    let runningTotal = 0;
    
    for (let i = 0; i < TIME_HORIZON_ARRAY.length; i++) {
      const contribution = payIn[i];
      const termCost = termSetAside[i];
      
      if (i === 0) {
        // Year 0: Just the contribution (no growth yet)
        runningTotal = contribution - termCost;
        marketGains.push(0);
      } else {
        // Calculate gains from previous year's balance
        const gains = runningTotal * MARKET_GAIN;
        marketGains.push(gains);
        
        // Add contribution, subtract term cost, add gains
        runningTotal = runningTotal + contribution - termCost + gains;
      }
      
      accountTotal.push(runningTotal);
    }

    // === FINAL METRICS ===
    const ACCOUNT_TOTAL = accountTotal[accountTotal.length - 1];
    const ACCOUNT_INCOME = ACCOUNT_TOTAL * MARKET_GAIN;
    const FINAL_YEAR_GROWTH = accountTotal[accountTotal.length - 1] - (accountTotal[accountTotal.length - 2] || 0);
    
    // Total paid in over time horizon
    const TOTAL_PAID_IN = payIn.reduce((sum, val) => sum + val, 0);
    const TOTAL_PAID_IN_ADJUSTED = payInAdjusted.reduce((sum, val) => sum + val, 0);
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
      
      // Arrays (developer-friendly names)
      arrays: {
        year: TIME_HORIZON_ARRAY,
        inflationValue: inflationValue,
        payIn: payIn,
        payInAdjusted: payInAdjusted,
        termSetAside: termSetAside,
        marketGains: marketGains,
        accountTotal: accountTotal
      },
      
      // Final results
      results: {
        ACCOUNT_TOTAL,
        ACCOUNT_INCOME,
        FINAL_YEAR_GROWTH,
        TOTAL_PAID_IN,
        TOTAL_PAID_IN_ADJUSTED,
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

// Auto-initialize if not already done
if (typeof window !== 'undefined' && window.dataLoader) {
  initCalcEngine().catch(console.error);
}
