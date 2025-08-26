# Codey-Hosted POC Deployment Guide

This guide walks you through deploying the codey-hosted application as a public POC.

## Quick Deploy to Vercel (Recommended)

### Prerequisites
- Vercel account (free tier works)
- Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Steps

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Navigate to the codey-hosted directory**:
   ```bash
   cd packages/codey-hosted
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

4. **Set Environment Variables** in Vercel Dashboard:
   - Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to Settings → Environment Variables
   - Add the following variables:

   | Variable           | Value                   | Description                         |
   |--------------------|-------------------------|-------------------------------------|
   | `POC_ACCESS_TOKEN` | `your-secret-token-123` | Simple auth token (make it secure!) |
   | `GEMINI_API_KEY`   | `your_gemini_api_key`   | From Google AI Studio               |
   | `NODE_ENV`         | `production`            | Environment setting                 |

5. **Redeploy** to apply environment variables:
   ```bash
   vercel --prod
   ```

## Usage

### Web Interface
Visit your deployed URL (e.g., `https://your-app.vercel.app`) and include the authorization header:

```javascript
// In browser console or client app
fetch('/api/sessions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-secret-token-123'
  },
  body: JSON.stringify({
    workspaceRoot: '/path/to/your/project'
  })
})
```

### API Endpoints

#### Create Session
```bash
curl -X POST https://your-app.vercel.app/api/sessions \
  -H "Authorization: Bearer your-secret-token-123" \
  -H "Content-Type: application/json" \
  -d '{"workspaceRoot": "/path/to/project"}'
```

#### Send Message
```bash
curl -X POST https://your-app.vercel.app/api/sessions/{sessionId}/messages \
  -H "Authorization: Bearer your-secret-token-123" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "workspaceRoot": "/path/to/project"}'
```

#### Health Check (No auth required)
```bash
curl https://your-app.vercel.app/api/health
```

## Security Notes for POC

- **Token-based auth**: Simple but effective for POC
- **Session cleanup**: Automatic cleanup every 30 minutes
- **CORS enabled**: For easy frontend integration
- **No persistent storage**: Sessions are lost on restart (POC limitation)

## Alternative Deployment Options

### Docker
```bash
# Build image
docker build -t codey-hosted .

# Run container
docker run -p 3000:3000 \
  -e POC_ACCESS_TOKEN=your-secret-token-123 \
  -e GEMINI_API_KEY=your_gemini_api_key \
  -e NODE_ENV=production \
  codey-hosted
```

### Traditional Server
```bash
# Install dependencies
npm install

# Build application
npm run build

# Set environment variables
export POC_ACCESS_TOKEN=your-secret-token-123
export GEMINI_API_KEY=your_gemini_api_key
export NODE_ENV=production

# Start server
npm start
```

## Monitoring

- Check Vercel Function logs in the dashboard
- Health endpoint: `/api/health`
- Session cleanup logs appear in server console

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check `POC_ACCESS_TOKEN` is set correctly
2. **Gemini API errors**: Verify `GEMINI_API_KEY` is valid
3. **Session not found**: Sessions expire after 2 hours of inactivity

### Debug Mode
Set `NODE_ENV=development` for more verbose logging.
