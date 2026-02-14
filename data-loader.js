/**
 * DATA LOADER - Optimized for StartWith60 calculations
 */

class DataLoader {
  constructor() {
    this.cache = {};
    this.loading = {};
  }

  async loadExcel(filename, sheetName = null) {
    const cacheKey = `${filename}_${sheetName || 'default'}`;
    
    if (this.cache[cacheKey]) return this.cache[cacheKey];
    if (this.loading[cacheKey]) return this.loading[cacheKey];
    
    this.loading[cacheKey] = this._fetchAndParse(filename, sheetName);
    const data = await this.loading[cacheKey];
    
    this.cache[cacheKey] = data;
    delete this.loading[cacheKey];
    return data;
  }

  async _fetchAndParse(filename, sheetName) {
    const response = await fetch(`/data/${filename}`);
    if (!response.ok) throw new Error(`Failed to load ${filename}: ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found in ${filename}`);
    
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  }

  async loadAll() {
    const [rateTables, mortality, marketHistory] = await Promise.all([
      this.loadExcel('RateTables.xlsx', 'LI_RATES'),
      this.loadExcel('Mortality.xlsx', 'Mortality'),
      this.loadExcel('MarketHistory.xlsx', 'Market')
    ]);
    
    return {
      rateTables: rateTables,  // Return raw - parsing happens in calc-engine
      mortality: this._parseMortality(mortality),
      marketHistory: this._parseMarketHistory(marketHistory)
    };
  }

  _parseMortality(raw) {
    const mortality = { male: {}, female: {} };
    
    // Male: rows 1-113
    for (let row = 1; row <= 113; row++) {
      const age = raw[row][0];
      if (age == null) continue;
      
      mortality.male[age] = {};
      for (let col = 2; col < raw[row].length; col++) {
        const years = col - 1;  // col 2 = 1 year, col 3 = 2 years
        mortality.male[age][years] = raw[row][col];
      }
    }
    
    // Female: rows 115-227
    for (let row = 115; row <= 227; row++) {
      const age = raw[row][0];
      if (age == null) continue;
      
      mortality.female[age] = {};
      for (let col = 2; col < raw[row].length; col++) {
        const years = col - 1;
        mortality.female[age][years] = raw[row][col];
      }
    }
    
    return mortality;
  }

  _parseMarketHistory(raw) {
    const history = [];
    const header = raw[1];
    
    for (let i = 2; i < 1386; i++) {
      const row = raw[i];
      const [year, month, amount] = row;
      
      if (!year || !month || !amount) continue;
      
      const entry = { year, month, amount, growth: {} };
      
      for (let j = 3; j < row.length; j++) {
        const years = header[j];
        const growthValue = row[j];
        if (years != null && growthValue != null) {
          entry.growth[years] = growthValue;
        }
      }
      
      history.push(entry);
    }
    
    return history;
  }
  
  clearCache() {
    this.cache = {};
  }
}

window.dataLoader = new DataLoader();
