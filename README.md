# StartWith60

**A financial education tool that shows people how small monthly investments compound over time.**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## What It Does

StartWith60 is an interactive calculator that helps people understand the power of compound interest. Users enter their age and monthly savings amount, and see:

- How much their money will grow by retirement
- Annual income their investments can generate
- The cost of waiting to start investing
- Guidance on debt vs investing decisions

Built for **mobile-first**, designed for **low-income users** on **slow connections**.

## Features

- ✅ Clean, emotional copywriting that drives action
- ✅ Smart routing (debt check, budget validation)
- ✅ Emotional amount descriptions ("HALF A MILLION DOLLARS")
- ✅ Legal disclaimers and S&P 500 historical data citations
- ✅ Under 25KB total size
- ✅ Works on any device, any connection speed
- ✅ No dependencies except Tailwind CDN

## File Structure

```
startwith60/
├── index.html          # Main application (everything in one file)
├── README.md           # This file
├── LICENSE             # MIT License
└── .gitignore          # Git ignore rules
```

## How It Works

### Calculations
- Uses S&P 500 historical average return: **10.4% annually** (1926-2024)
- Assumes monthly contributions with compound interest
- Conservative estimates (no adjustments for inflation)

### Pages
1. **Page 1.0** - Age and budget input
2. **Page 1.01** - Results reveal with emotional copy
3. **Page 1.02** - Debt check question
4. **Page 1.03** - Loss aversion (cost of waiting)
5. **Page 1.04** - Debt payoff redirect
6. **Page 1.05** - Setup instructions (placeholder)

### Tech Stack
- **HTML5** - Structure
- **Tailwind CSS** - Styling (via CDN)
- **Vanilla JavaScript** - Logic and state management
- **No build process** - Works out of the box

## Customization

### Changing Copy
All copy is in the `Pages` object in `index.html`. Search for the text you want to change and edit it directly.

### Modifying Calculations
The `Calculator` object contains all financial formulas. Adjust return rates or time periods there.

### Adding Pages
1. Add a new function to the `Pages` object
2. Add navigation logic in `attachEventListeners()`
3. Update the flow as needed

## Legal & Compliance

This tool includes:
- ✅ "Past performance does not guarantee future results" disclaimers
- ✅ "Educational information only, not personal advice" statements
- ✅ Data source citations (S&P 500, 1926-2024)
- ✅ Risk disclosures
- ✅ Recommendation to consult financial advisors

**Note:** This is educational content. Always have legal/compliance review before public launch.

## Performance

- **File Size:** ~25KB
- **Load Time:** <1 second on 3G
- **Dependencies:** Only Tailwind CDN
- **Browser Support:** All modern browsers (Chrome, Firefox, Safari, Edge)

## Contributing

This is a personal project, but suggestions are welcome:
1. Open an issue describing your idea
2. If adding features, keep file size minimal
3. Maintain mobile-first design principles

## License

MIT License - See LICENSE file for details

## Author

Created for financial literacy education.

## Disclaimer

This tool provides educational information only and should not be considered financial advice. All investments carry risk. Past performance does not guarantee future results. Consult with a licensed financial advisor before making investment decisions.

---

**Questions?** Open an issue or contact the maintainer.
