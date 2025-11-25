# Messages Bundler Bot

A Telegram bot that bundles multiple forwarded messages into a single shareable link, deployed on Cloudflare Workers.

## Acknowledgments

- Frontend based on [chatrecord-viewer](https://github.com/clansty/chatrecord-viewer) by @Clansty
- Inspired by [@MessagesBundlerBot](https://t.me/MessagesBundlerBot)

## Features

- 📦 Bundle multiple forwarded messages into one shareable link
- 🔐 End-to-end encryption - Messages are encrypted client-side, the server cannot read them
- 👁 Preview bundles in Telegram Mini App (Vue.js frontend)
- 📤 Share bundles via inline mode
- ⚡ Fast and serverless, deployed on Cloudflare Workers
- 💾 Permanent storage in Cloudflare KV (with compression)

## How It Works

1. When you create a bundle, messages are compressed (pako) and encrypted (AES-256-GCM)
2. The encryption key is embedded in the share URL, never stored on the server
3. Only users with the full link can decrypt and view the messages
4. Even the server operator cannot read stored messages

## Usage

1. Forward messages to the bot (no need to `/start` first)
2. Send `/done` to create the bundle
3. Use **Preview** to view or **Send to chat** to share

### Commands

| Command   | Description                |
| --------- | -------------------------- |
| `/start`  | Start a new bundle session |
| `/done`   | Finish and create bundle   |
| `/cancel` | Cancel current bundle      |
| `/help`   | Show help                  |

### Inline Mode

Type `@YourBotUsername <share_id>` in any chat to share a bundle.

## Project Structure

```
main/
├── src/                    # Worker source code
│   ├── index.ts            # Main entry point
│   ├── handlers/           # Command & message handlers
│   ├── crypto.ts           # Encryption utilities
│   └── types/              # TypeScript types
├── view/                   # Vue.js frontend
│   ├── main/               # Main app
│   └── packages/           # Shared components
├── scripts/
│   └── deploy.cjs          # Deployment script
├── wrangler.toml.example   # Example config
└── package.json
```

## Deployment

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- [Cloudflare account](https://dash.cloudflare.com/)
- [Telegram Bot Token](https://t.me/BotFather)

### Steps

1. **Clone and install dependencies**

   ```bash
   git clone <repo>
   cd messages-bundler/main
   pnpm install
   ```

2. **Create configuration file**

   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

3. **Create a Cloudflare KV namespace**

   ```bash
   npx wrangler kv:namespace create BUNDLES
   npx wrangler kv:namespace create BUNDLES --preview
   ```

   Update `wrangler.toml` with the output IDs.

4. **Set your bot token as a secret**

   ```bash
   npx wrangler secret put BOT_TOKEN
   ```

5. **Update `wrangler.toml`**

   - Set `name` to your worker name
   - Set `BOT_USERNAME` to your bot's username (without @)
   - Set your custom domain in `routes` (optional)

6. **Deploy (builds frontend + deploys worker)**

   ```bash
   pnpm run deploy:all
   ```

7. **Set up webhook**

   Visit: `https://your-worker-url/setup-webhook`

8. **Create Mini App in BotFather**

   - Send `/newapp` to @BotFather
   - Select your bot
   - Set app name: `view`
   - Set app URL: `https://your-worker-url/view`

## Development

```bash
# Start worker locally
pnpm run dev

# In another terminal, start frontend dev server
cd view
pnpm install
pnpm run dev
```

Note: Telegram webhooks won't work locally unless you use a tunnel like ngrok.

## API Endpoints

| Endpoint                 | Description                         |
| ------------------------ | ----------------------------------- |
| `POST /webhook`          | Telegram webhook receiver           |
| `GET /setup-webhook`     | Set up Telegram webhook             |
| `GET /webhook-info`      | Get current webhook info            |
| `GET /api/bundle/:id`    | Get encrypted bundle data           |
| `GET /api/file/:fileId`  | Proxy Telegram files                |
| `GET /api/avatar/:userId`| Proxy user profile photos           |
| `GET /view/*`            | Mini App viewer (static Vue.js app) |

## Environment Variables

| Variable         | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `BOT_TOKEN`      | Telegram bot token (set as secret via wrangler)      |
| `BOT_USERNAME`   | Bot username without @                               |
| `WEBHOOK_SECRET` | Secret for Telegram webhook verification             |
| `ADMIN_SECRET`   | (Optional) Secret for admin endpoints                |

## Security

- **E2E Encryption**: AES-256-GCM encryption with keys only in URLs
- **Compression**: pako (zlib) compression before encryption
- **No plaintext storage**: Server stores only encrypted data + metadata
- **Webhook Protection**: Telegram sends `X-Telegram-Bot-Api-Secret-Token` header for verification
- **Admin Endpoints**: `/setup-webhook` and `/webhook-info` require `?secret=ADMIN_SECRET`

## License

MIT
