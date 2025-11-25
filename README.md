# Messages Bundler Bot

A Telegram bot that bundles multiple forwarded messages into a single shareable link, deployed on Cloudflare Workers.

## Features

- 📦 Bundle multiple forwarded messages into one shareable link
- 👁 Preview bundles in Telegram Mini App
- 📤 Share bundles via inline mode
- ⚡ Fast and serverless, deployed on Cloudflare Workers
- 💾 Messages stored in Cloudflare KV with 30-day retention

## Usage

1. Send `/start` to the bot
2. Forward messages you want to bundle
3. Send `/done` to create the bundle
4. Use **Preview** to view or **Send to chat** to share

### Inline Mode

Type `@MessagesBundleBot <bundle_id>` in any chat to share a bundle.

## Deployment

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare account](https://dash.cloudflare.com/)
- [Telegram Bot Token](https://t.me/BotFather)

### Steps

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Create a Cloudflare KV namespace**

   ```bash
   npx wrangler kv:namespace create BUNDLES
   npx wrangler kv:namespace create BUNDLES --preview
   ```

   Copy the output IDs and update `wrangler.toml`:

   ```toml
   [[kv_namespaces]]
   binding = "BUNDLES"
   id = "your-production-id"
   preview_id = "your-preview-id"
   ```

3. **Set your bot token as a secret**

   ```bash
   npx wrangler secret put BOT_TOKEN
   ```

   Enter your Telegram bot token when prompted.

4. **Update bot username in `wrangler.toml`**

   ```toml
   [vars]
   BOT_USERNAME = "YourBotUsername"
   ```

5. **Deploy**

   ```bash
   pnpm run deploy
   ```

6. **Set up webhook**

   After deployment, visit:
   ```
   https://your-worker.workers.dev/setup-webhook
   ```

7. **Create Mini App (optional)**

   In BotFather, set up a Mini App:
   - Send `/newapp` to @BotFather
   - Select your bot
   - Set app name (e.g., "view")
   - Set app URL: `https://your-worker.workers.dev/view`

## Development

```bash
pnpm run dev
```

This starts a local development server. Note that Telegram webhooks won't work locally unless you use a tunnel like ngrok.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /webhook` | Telegram webhook receiver |
| `GET /setup-webhook` | Set up Telegram webhook |
| `GET /webhook-info` | Get current webhook info |
| `GET /api/bundle/:id` | Get bundle data as JSON |
| `GET /api/file/:fileId` | Proxy Telegram files |
| `GET /view` | Mini App viewer |
| `GET /health` | Health check |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram bot token (set as secret) |
| `BOT_USERNAME` | Bot username without @ |
| `BUNDLES` | KV namespace binding |

## License

MIT
