# Terms Acceptance Logging

## Overview

The application now logs all terms and conditions acceptances to Netlify Forms for non-repudiation purposes. This provides a permanent, auditable record of user agreements.

## What Gets Logged

Each time a user completes the onboarding screen, the following information is captured:

- **Full Name**: The name entered by the user
- **Date**: The date the user signed the agreement
- **Timestamp**: Exact ISO 8601 timestamp of submission (e.g., `2025-10-29T13:30:45.123Z`)
- **Agreed**: Confirmation that the checkbox was checked (`true`)
- **IP Address**: Automatically captured by Netlify (not shown in form data but recorded)
- **User Agent**: Automatically captured by Netlify

## How to Access the Logs

### Via Netlify Dashboard

1. Log in to your Netlify account at https://app.netlify.com
2. Select your site (Splashworks Pool Service BI Visualizer)
3. Go to **Forms** in the left sidebar
4. Click on **terms-acceptance** form
5. View all submissions with timestamps

### Export Options

**CSV Export:**
1. In the Forms section, click on **terms-acceptance**
2. Click the **Export** button at the top right
3. Download as CSV for spreadsheet analysis

**API Access:**
- Netlify provides API access to form submissions
- Can be integrated into reporting systems if needed
- Documentation: https://docs.netlify.com/api/get-started/

## Data Retention

- Netlify stores form submissions indefinitely on paid plans
- Free tier: 100 submissions/month, stored for 1 month
- Level 1 plan ($19/month): Unlimited submissions, indefinite storage
- Enterprise: Custom retention policies available

## Compliance Features

✅ **Non-repudiation**: Timestamped records with IP addresses  
✅ **Immutable**: Submissions cannot be edited after creation  
✅ **Exportable**: Can be exported for legal/audit purposes  
✅ **GDPR Compliant**: Netlify is GDPR compliant  
✅ **Encrypted**: Data transmitted over HTTPS  
✅ **Spam Protected**: Honeypot field prevents bot submissions

## Example Log Entry

```
Name: John Smith
Date: 2025-10-29
Timestamp: 2025-10-29T13:30:45.123Z
Agreed: true
IP Address: 192.168.1.1 (captured by Netlify)
User Agent: Mozilla/5.0... (captured by Netlify)
```

## Integration Notes

- Form submissions happen asynchronously
- User access is not blocked if submission fails
- Console logs track submission status for debugging
- Form name: `terms-acceptance`

## Testing

To test the logging:

1. Clear your browser's localStorage for the site
2. Reload the application
3. Complete the onboarding form
4. Check Netlify dashboard → Forms → terms-acceptance
5. Verify the submission appears with correct data

## Troubleshooting

**Form not appearing in Netlify:**
- Ensure the site has been deployed after adding the form
- Check that `public/terms-acceptance-form.html` exists in your build
- Netlify detects forms during build process

**Submissions not recording:**
- Check browser console for errors
- Verify network tab shows POST request to `/`
- Ensure Netlify Forms are enabled in site settings

## Future Enhancements

Possible additions:
- Email notifications on new submissions
- Webhook integration to external logging systems
- Automated compliance reports
- Integration with document management systems
