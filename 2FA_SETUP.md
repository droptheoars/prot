# 2FA Authentication Setup Guide

## Important: Two-Factor Authentication Required

The Norwegian Shareholder Registry (aksjeeierregisteret.no) requires 2FA via email. This guide explains how to handle this authentication.

## How 2FA Works

1. When you log in with username/password, the site sends a 6-digit code to your registered email
2. You must enter this code to complete authentication
3. The code expires after a few minutes

## Running the Scraper Locally (Manual 2FA)

### Option 1: Interactive 2FA Input
```bash
cd /Users/erikkahr/Norwegian-Shareholder-Scraper
python manual_2fa_scraper.py
```

When prompted:
1. Choose to enter the 2FA code manually
2. Check your email for the code
3. Enter the 6-digit code when prompted
4. The scraper will continue automatically

### Option 2: Browser-Assisted Login
```bash
python manual_2fa_scraper.py
```

When prompted:
1. Choose NOT to enter the code
2. Open https://www.aksjeeierregisteret.no/login/ in your browser
3. Log in manually with your credentials
4. Enter the 2FA code from your email in the browser
5. The scraper will detect the successful login and continue

## Automated Solutions (GitHub Actions)

### Current Limitation
GitHub Actions cannot directly access your email for the 2FA code. Consider these solutions:

### Solution 1: Email Forwarding Service
Set up an email automation that:
1. Monitors your inbox for 2FA emails from noreply@aksjeeierregisteret.no
2. Extracts the 6-digit code
3. Posts it to a webhook or API that GitHub Actions can access

### Solution 2: Session Token Approach
1. Log in manually once per month
2. Save the session cookies
3. Use the saved session in GitHub Actions
4. Note: Sessions may expire, requiring periodic manual refresh

### Solution 3: Manual Daily Run
Instead of fully automated GitHub Actions:
1. Use the `manual_2fa_scraper.py` script
2. Run it locally once per day
3. The script will still update Webflow automatically

## Testing the Authentication

Test your setup:
```bash
# Test configuration
python test_shareholder_config.py

# Test with manual 2FA
python manual_2fa_scraper.py
```

## Security Notes

- **NEVER** commit your password or 2FA codes to Git
- **NEVER** share your .env file
- Use GitHub Secrets for sensitive data
- Rotate your password regularly
- Monitor login attempts to your account

## Troubleshooting

### "Authentication failed"
- Verify username/password in .env file
- Check if account is locked
- Ensure 2FA code is entered correctly

### "No shareholders found"
- Verify you're logged in successfully
- Check if the Protector company page loads
- Ensure organization number (985279721) is correct

### "2FA code expired"
- Request a new code by trying to login again
- Enter the code more quickly (usually valid for 5-10 minutes)

## Company Navigation

The scraper automatically:
1. Logs in with your credentials
2. Handles 2FA (with your input)
3. Searches for "Protector"
4. Navigates to PROTECTOR FORSIKRING ASA (org: 985279721)
5. Scrapes the top 20 shareholders
6. Updates your Webflow collection

## Contact

For issues with:
- **2FA/Login**: Contact aksjeeierregisteret.no support
- **Scraper**: Check GitHub issues or logs
- **Webflow**: Verify API token and collection ID