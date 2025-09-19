# Norwegian Shareholder Registry Scraper - Setup Guide

## Overview
The Norwegian Shareholder Registry scraper automatically extracts the top 20 shareholders from aksjeeierregisteret.no and updates your Webflow website daily at 12:00 PM UTC.

## Files Added to Repository
- `shareholder_main.py` - Main execution script
- `shareholder_scraper.py` - Core scraping functionality  
- `shareholder_webflow_api.py` - Webflow API integration
- `shareholder_config.py` - Configuration management
- `shareholder-requirements.txt` - Python dependencies
- `shareholder-scraper.env.example` - Environment variables template
- `.github/workflows/shareholder-scraper.yml` - GitHub Actions workflow
- `test_shareholder_config.py` - Configuration testing script

## Setup Instructions

### 1. GitHub Secrets Configuration

Go to your GitHub repository: https://github.com/droptheoars/prot.git

Navigate to: **Settings > Secrets and variables > Actions**

Add the following repository secrets:

#### Required Secrets:
- `REGISTRY_USERNAME` - Your Norwegian shareholder registry username
- `REGISTRY_PASSWORD` - Your Norwegian shareholder registry password  
- `WEBFLOW_API_TOKEN` - Your Webflow API token
- `WEBFLOW_COLLECTION_ID` - Your Webflow collection ID for shareholders

#### Optional Secrets:
- `WEBFLOW_SITE_ID` - Your Webflow site ID (for publishing)

### 2. Getting Webflow Credentials

#### Webflow API Token:
1. Go to your Webflow dashboard
2. Navigate to Project Settings > Integrations > API Access
3. Generate a new API token
4. Copy the token and add it as `WEBFLOW_API_TOKEN` secret

#### Webflow Collection ID:
1. In your Webflow project, go to the CMS Collections
2. Click on your shareholders collection
3. Look in the URL - the collection ID is the long string after `/collections/`
4. Example: `https://webflow.com/design/yoursite/cms/collections/60a1b2c3d4e5f6g7h8i9j0k1`
5. Collection ID would be: `60a1b2c3d4e5f6g7h8i9j0k1`

### 3. Webflow Collection Setup

Your Webflow collection should have these fields:
- `name` (Text) - Full name/company name
- `surname-company` (Text) - Surname or company name  
- `first-name` (Text) - First name
- `holdings` (Text) - Number of shares held
- `percentage` (Text) - Ownership percentage
- `rank` (Number) - Ranking position (1-20)
- `slug` (Text) - Auto-generated slug for URL

### 4. Local Testing Setup

#### Create Local Environment File:
```bash
cd "/Users/erikkahr/Norwegian-Shareholder-Scraper"
cp shareholder-scraper.env.example .env
```

#### Edit .env file with your credentials:
```env
REGISTRY_USERNAME=your_actual_username
REGISTRY_PASSWORD=your_actual_password
WEBFLOW_API_TOKEN=your_actual_webflow_token
WEBFLOW_COLLECTION_ID=your_actual_collection_id
WEBFLOW_SITE_ID=your_actual_site_id
```

#### Test the configuration:
```bash
python test_shareholder_config.py
```

#### Run a test scrape:
```bash
python shareholder_main.py
```

### 5. GitHub Actions Workflow

The scraper runs automatically:
- **Daily at 12:00 PM UTC** via scheduled cron job
- **Manual trigger** available in GitHub Actions tab

To manually trigger:
1. Go to **Actions** tab in your GitHub repository
2. Click on **Norwegian Shareholder Registry Scraper**
3. Click **Run workflow** button

### 6. Monitoring and Logs

- Check the **Actions** tab for run status
- Logs are uploaded as artifacts for each run
- Logs are retained for 30 days
- Local logs saved to `shareholder-scraper.log`

### 7. Troubleshooting

#### Authentication Issues:
- Verify registry username/password are correct
- Check if login URL has changed
- Review scraper logs for authentication errors

#### Scraping Issues:
- Check if target URL is still valid: https://www.aksjeeierregisteret.no/content/security/?orgnr=985279721&companies-search=protect
- Verify HTML structure hasn't changed
- Look for investor rows with `id` starting with "investor-"

#### Webflow Issues:
- Verify API token has correct permissions
- Check collection ID is accurate
- Ensure field names match the code
- Test Webflow API manually if needed

### 8. Security Notes

- Never commit `.env` files to the repository
- Use GitHub Secrets for all sensitive data
- Regularly rotate API tokens and passwords
- Monitor logs for suspicious activity

### 9. Schedule Customization

To change the run schedule, edit `.github/workflows/shareholder-scraper.yml`:

```yaml
schedule:
  - cron: '0 12 * * *'  # Daily at 12:00 PM UTC
```

Common schedules:
- `'0 9 * * 1-5'` - Weekdays at 9:00 AM UTC
- `'0 */6 * * *'` - Every 6 hours
- `'0 12 * * 1'` - Weekly on Mondays at noon

## Next Steps

1. **Add GitHub Secrets** (Step 1 above)
2. **Test locally** with your credentials (Steps 4-5)
3. **Trigger first GitHub Actions run** manually (Step 5)
4. **Verify Webflow updates** are working
5. **Monitor daily runs** for any issues

The scraper is now ready for production use!