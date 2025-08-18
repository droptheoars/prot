# Euronext Press Release Automation

A production-ready system that monitors Euronext press releases and automatically publishes them to Webflow CMS with complete content extraction.

## 🎯 Features

- **Automated Monitoring**: Checks for new press releases every 2 minutes during business hours
- **Complete Content Extraction**: Extracts full press release content from Euronext's modal system
- **Webflow Integration**: Automatically creates properly formatted CMS entries
- **Smart Deduplication**: Prevents duplicate entries while allowing similar titles
- **Business Hours Scheduling**: Only runs during Norwegian business hours (6am-9pm, weekdays)
- **State Management**: Tracks processed releases to avoid reprocessing
- **Comprehensive Logging**: Full audit trail and monitoring capabilities
- **Serverless Architecture**: Cost-effective AWS Lambda deployment

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   EventBridge   │───▶│    Lambda    │───▶│    Webflow     │
│   (Scheduler)   │    │  (Processor) │    │     CMS        │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │  DynamoDB    │
                        │   (State)    │
                        └──────────────┘
                              ▲
                              │
                        ┌──────────────┐
                        │  Euronext    │
                        │   Website    │
                        └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- AWS Account with CLI configured
- Webflow account with API access
- Git

### 1. Clone and Setup

```bash
git clone https://github.com/droptheoars/prot.git
cd final-euronext-prot-press
yarn install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```



### 3. Local Testing

```bash
# Test individual components
yarn run local components

# Test full run
yarn run local full

# Test health check
yarn run local health

# Run all tests
yarn run local all
```

### 4. Deploy to AWS

```bash
# Deploy complete infrastructure
node deploy/aws-setup.js
```

This will create:
- DynamoDB table for state management
- Lambda function with proper permissions
- EventBridge rule for scheduling
- IAM roles with minimal required permissions

## 📋 Configuration

### Business Hours

The system automatically respects Norwegian business hours:
- **Days**: Monday - Friday
- **Hours**: 6:00 AM - 9:00 PM (Norway time)
- **Frequency**: Every 2 minutes during business hours

### Content Extraction

The scraper targets the third `row mb-5` div class within Euronext's modal system to extract complete press release content including:
- Full formatted text
- Publication dates
- Company information
- Rich text formatting

### Webflow Collection Fields

The system populates these Webflow CMS fields:
- `name`: Press release title (required)
- `slug`: URL-friendly identifier (required)
- `date`: Publication date (Date/Time)
- `content`: Full press release content (Rich text)
- `read-more-link`: Link to original press release (Link)

## 🔧 Local Development

### Running Individual Components

```bash
# Test scraper only
node -e "const EuronextScraper = require('./src/euronext-scraper'); new EuronextScraper().scrapeLatest().then(console.log)"

# Test Webflow connection
node -e "const WebflowClient = require('./src/webflow-client'); new WebflowClient().testConnection().then(console.log)"

# Test DynamoDB connection
node -e "const StateManager = require('./src/state-manager'); new StateManager().testConnection().then(console.log)"
```

### Manual Execution

```bash
# Run the main process locally
yarn start

# Test with specific actions
node src/lambda-handler.js
```

## 📊 Monitoring

### Health Check

```bash
curl -X GET https://your-api-gateway-url/health
```

### Processing Stats

```bash
curl -X GET https://your-api-gateway-url/stats
```

### AWS CloudWatch Logs

Monitor the Lambda function logs in AWS CloudWatch:
```
/aws/lambda/euronext-press-release-automation
```

## 🛠️ Troubleshooting

### Common Issues

1. **Puppeteer fails to start**
   - Ensure Chrome dependencies are installed
   - Check Lambda memory allocation (recommended: 1024MB)

2. **Webflow rate limiting**
   - System respects 60 requests/minute limit
   - Automatic retry with exponential backoff

3. **Content extraction fails**
   - Check if Euronext website structure has changed
   - Review CloudWatch logs for specific errors

4. **DynamoDB permissions**
   - Ensure Lambda role has DynamoDB access
   - Check table exists and TTL is configured

### Debug Mode

Enable verbose logging by setting environment variable:
```bash
DEBUG=true node src/index.js
```

## 🔒 Security

- **Minimal IAM permissions**: Lambda role only has required DynamoDB and CloudWatch access
- **Environment variables**: Sensitive data stored securely in Lambda environment
- **Rate limiting**: Respectful scraping with appropriate delays
- **Error handling**: Graceful failure without exposing credentials

## 💰 Cost Optimization

Expected AWS costs (monthly):
- **Lambda**: $1-3 (based on 2-minute execution frequency)
- **DynamoDB**: $1-2 (pay-per-request pricing)
- **EventBridge**: $0.50 (rule executions)
- **CloudWatch**: $0.50 (logs)

**Total estimated cost**: Under $10/month

## 📈 Performance

- **Execution time**: Sub-10 seconds typical
- **Memory usage**: 512-1024MB optimal
- **Concurrency**: Designed for single execution
- **Reliability**: 99.9% uptime target

## 🔄 Updates and Maintenance

### Updating the Lambda Function

```bash
# Redeploy with latest code
node deploy/aws-setup.js
```

### Database Maintenance

- Automatic TTL cleanup (365 days for press releases, 30 days for metadata)
- No manual maintenance required

### Monitoring Recommendations

1. Set up CloudWatch alarms for function errors
2. Monitor DynamoDB throttling metrics
3. Track Webflow API rate limiting
4. Review processing stats weekly

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and support:
1. Check the troubleshooting section
2. Review CloudWatch logs
3. Create an issue on GitHub
4. Contact the development team

---

Built with ❤️ for reliable, production-grade automation
