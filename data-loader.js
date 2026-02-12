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
    const mortality = {
      male: {},
      female: {}
    };
    
    // Row 0 has header: MALE, PROBABILITY OF DYING IN THE NEXT X YEARS:, 1, 2, 3...
    // Rows 1+ have: age, population, prob_1yr, prob_2yr, prob_3yr...
    
    const header = raw[0];
    const yearColumns = header.slice(2); // Years are in columns 2+
    
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];
      const age = row[0];
      
      if (age === null || age === undefined) break;
      
      mortality.male[age] = {};
      
      for (let j = 0; j < yearColumns.length; j++) {
        const years = yearColumns[j];
        const probability = row[j + 2];
        
        if (probability !== null && probability !== undefined) {
          mortality.male[age][years] = probability;
        }
      }
    }
    
    // TODO: Add female mortality parsing if in separate section
    
    return mortality;
  }

  /**
   * Parse market history
   * Structure: Array of { year, month, amount, growth_1yr, growth_2yr, ... }
   */
  _parseMarketHistory(raw) {
    const history = [];
    
    // Row 0 has headers: Year, Month, Amount ($), then growth columns
    const header = raw[0];
    
    for (let i = 1; i < raw.length; i++) {
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
        const years = header[j];
        const growthValue = row[j];
        
        if (years !== null && growthValue !== null) {
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
