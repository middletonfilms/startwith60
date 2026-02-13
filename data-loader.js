/**
 * DATA LOADER
 * Fetches Excel files from /data folder and caches them
 * Returns parsed data as JavaScript objects
 */

class DataLoader {
  constructor() {
    this.cache = {};
    this.loading = {};
  }

  /**
   * Load Excel file and return as JSON
   * @param {string} filename - Name of file in /data folder
   * @param {string} sheetName - Name of sheet to read (optional, defaults to first sheet)
   * @returns {Promise<Array>} Array of row objects
   */
  async loadExcel(filename, sheetName = null) {
    const cacheKey = `${filename}_${sheetName || 'default'}`;
    
    // Return cached if available
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }
    
    // Wait if already loading
    if (this.loading[cacheKey]) {
      return this.loading[cacheKey];
    }
    
    // Load file
    this.loading[cacheKey] = this._fetchAndParse(filename, sheetName);
    const data = await this.loading[cacheKey];
    
    // Cache and return
    this.cache[cacheKey] = data;
    delete this.loading[cacheKey];
    return data;
  }

  async _fetchAndParse(filename, sheetName) {
    try {
      const response = await fetch(`/data/${filename}`);
      if (!response.ok) throw new Error(`Failed to load ${filename}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Get sheet
      const sheet = sheetName 
        ? workbook.Sheets[sheetName]
        : workbook.Sheets[workbook.SheetNames[0]];
      
      if (!sheet) throw new Error(`Sheet ${sheetName} not found in ${filename}`);
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      
      return data;
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Load all data files at once
   * @returns {Promise<Object>} Object with rateTables, mortality, marketHistory
   */
  async loadAll() {
    const [rateTables, mortality, marketHistory] = await Promise.all([
      this.loadExcel('RateTables.xlsx', 'LI_RATES'),
      this.loadExcel('Mortality.xlsx', 'Mortality'),
      this.loadExcel('MarketHistory.xlsx', 'Market')
    ]);
    
    return {
      rateTables: this._parseRateTables(rateTables),
      mortality: this._parseMortality(mortality),
      marketHistory: this._parseMarketHistory(marketHistory)
    };
  }

  /**
   * Parse rate tables into usable structure
   * Structure: { age: { male: rate, female: rate, ... } }
   */
  _parseRateTables(raw) {
    const rates = {};
    
    // Find age column (column 0)
    // Find male/female rate columns
    // Row 3 has "MALE RATE PER 1000" and "FEMALE RATE PER 1000" labels
    
    for (let i = 4; i < raw.length; i++) {
      const row = raw[i];
      const age = row[0];
      
      if (age === null || age === undefined || age === '') break;
      
      rates[age] = {
        male: row[1] || null,      // REGULAR male rate
        female: row[2] || null,    // REGULAR female rate
        // Add more rate types as needed
      };
    }
    
    return rates;
  }

  /**
   * Parse mortality table
   * Structure: { male: { age: { years: probability } }, female: { ... } }
   */
  _parseMortality(raw) {
  const mortality = { male: {}, female: {} };
  
  // Male section: rows 1-113 (age 0-112)
  for (let row = 1; row <= 113; row++) {
    const age = raw[row][0];
    if (age === null || age === undefined) continue;
    
    mortality.male[age] = {};
    for (let col = 2; col < raw[row].length; col++) {
      const years = col - 2 + 1; // col 2 = 1 year, col 3 = 2 years
      mortality.male[age][years] = raw[row][col];
    }
  }
  
  // Female section: rows 115-227
  for (let row = 115; row < raw.length && row <= 227; row++) {
    const age = raw[row][0];
    if (age === null || age === undefined) continue;
    
    mortality.female[age] = {};
    for (let col = 2; col < raw[row].length; col++) {
      const years = col - 2 + 1; // col 2 = 1 year, col 3 = 2 years
      mortality.female[age][years] = raw[row][col];
    }
  }
  
  return mortality;
}

  /**
   * Parse market history
   * Structure: Array of { year, month, amount, growth_1yr, growth_2yr, ... }
   */
  _parseMarketHistory(raw) {
  const history = [];
  
  // Row 1 has headers: Year, Month, Amount ($), then 1, 2, 3, 4... (year spans)
  const header = raw[1];
  
  // Data starts at row 2, goes until row 1385 (before percentile section at 1386)
  for (let i = 2; i < 1386; i++) {
    const row = raw[i];
    
    const year = row[0];
    const month = row[1];
    const amount = row[2];
    
    if (!year || !month || !amount) continue;
    
    const entry = {
      year,
      month,
      amount,
      growth: {}
    };
    
    // Columns 3+ are growth over X years
    for (let j = 3; j < row.length; j++) {
      const years = header[j]; // This is 1, 2, 3, 4, etc.
      const growthValue = row[j];
      
      if (years !== null && years !== undefined && growthValue !== null && growthValue !== undefined) {
        entry.growth[years] = growthValue;
      }
    }
    
    history.push(entry);
  }
  
  return history;
}
}

// Create global instance
window.dataLoader = new DataLoader();
