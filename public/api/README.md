# API Data Files

This directory contains the local data files for the Institutional Marketplace platform.

## Files

- `buy.json` - BUY listings data from Google Sheets
- `sell.json` - SELL listings data from Google Sheets
- `logos.json` - Company logos mapping (company name -> logo URL)

## Data Structure

### buy.json and sell.json

These files contain data in Google Sheets API response format:

```json
{
  "range": "SHEET_NAME!A1:AC###",
  "majorDimension": "ROWS",
  "values": [
    ["Header1", "Header2", ...],
    ["Row1Col1", "Row1Col2", ...],
    ...
  ]
}
```

### logos.json

Company name to logo URL mapping (all company names are uppercase):

```json
{
  "COMPANY NAME": "https://url-to-logo.com/logo.jpeg",
  ...
}
```

## Updating Data

To update the data from Google Sheets, run:

```bash
# Download BUY data
curl -s "https://sheets.googleapis.com/v4/spreadsheets/1YPRlj63vZpNkhdKojGcKsaKffxzbdhTNdUzuOMiIp7U/values/BUY?key=AIzaSyChHRO-CIWmtR29XeIBkHnYmbfJweH1PPQ" -o api/buy.json

# Download SELL data
curl -s "https://sheets.googleapis.com/v4/spreadsheets/1YPRlj63vZpNkhdKojGcKsaKffxzbdhTNdUzuOMiIp7U/values/SELL?key=AIzaSyChHRO-CIWmtR29XeIBkHnYmbfJweH1PPQ" -o api/sell.json

# Download and convert logos
curl -sL "https://docs.google.com/spreadsheets/d/1kQr17XMj8-iNjGP7OAwLNz6p5juvJJ0obyUmqBH_lmU/export?format=csv" | python3 -c "
import csv
import json
import sys

logos = {}
reader = csv.DictReader(sys.stdin)
for row in reader:
    name = row['name'].strip()
    url = row['image_url'].strip()
    logos[name.upper()] = url

json.dump(logos, sys.stdout, indent=2)
" > api/logos.json
```

Or use the update script (if created):

```bash
./scripts/update-data.sh
```

## Migration Notes

The platform has been migrated from direct Google Sheets API calls to local JSON files:

- **Before**: Data was loaded from `sheets.googleapis.com` on each page load
- **After**: Data is loaded from local `/api/*.json` files
- **Benefits**:
  - Faster page load times (no external API calls)
  - No dependency on Google Sheets API quota
  - Works without internet connection (after initial load)
  - Better for production deployment

## Deployment

These JSON files are automatically deployed to GitHub Pages along with `index.html`.

### Deployment Workflow

1. Update data: `./scripts/update-data.sh`
2. Commit changes: `git add api/ && git commit -m "chore: update data"`
3. Push to main: `git push`
4. Deploy to GitHub Pages: `./scripts/deploy-to-github-pages.sh`

See [DEPLOYMENT.md](../../DEPLOYMENT.md) in the repository root for detailed deployment instructions.

### Live Site

The marketplace is live at: **https://xqtrn.github.io/Institutional-Marketplace/**
