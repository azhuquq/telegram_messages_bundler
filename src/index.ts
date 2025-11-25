import type { TelegramUpdate } from './types/telegram';
import type { MessageBundle } from './types/bundle';
import { TelegramAPI } from './telegram';
import { 
  handleStartCommand, 
  handleDoneCommand, 
  handleCancelCommand, 
  handleHelpCommand,
  handleForwardedMessage 
} from './handlers/commands';
import { handleInlineQuery } from './handlers/inline';
import { handleCallbackQuery } from './handlers/callback';

export interface Env {
  BUNDLES: KVNamespace;
  BOT_TOKEN: string;
  BOT_USERNAME: string;
  WEBHOOK_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Handle webhook setup
    if (url.pathname === '/setup-webhook') {
      const api = new TelegramAPI(env.BOT_TOKEN);
      const webhookUrl = `${baseUrl}/webhook`;
      await api.setWebhook(webhookUrl);
      return new Response(`Webhook set to: ${webhookUrl}`);
    }

    // Handle webhook info
    if (url.pathname === '/webhook-info') {
      const api = new TelegramAPI(env.BOT_TOKEN);
      const info = await api.getWebhookInfo();
      return new Response(JSON.stringify(info, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle Telegram webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update: TelegramUpdate = await request.json();
        await handleUpdate(update, env, baseUrl);
        return new Response('OK');
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error', { status: 500 });
      }
    }

    // API: Get bundle data
    if (url.pathname.startsWith('/api/bundle/')) {
      const bundleId = url.pathname.split('/').pop();
      if (!bundleId) {
        return new Response('Bundle ID required', { status: 400 });
      }

      const bundle = await env.BUNDLES.get<MessageBundle>(`bundle:${bundleId}`, 'json');
      if (!bundle) {
        return new Response('Bundle not found', { status: 404 });
      }

      return new Response(JSON.stringify(bundle), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // API: Get file proxy (for Telegram files)
    if (url.pathname.startsWith('/api/file/')) {
      const fileId = url.pathname.split('/').pop();
      if (!fileId) {
        return new Response('File ID required', { status: 400 });
      }

      const api = new TelegramAPI(env.BOT_TOKEN);
      try {
        const file = await api.getFile(fileId);
        if (!file.file_path) {
          return new Response('File not available', { status: 404 });
        }

        const fileUrl = api.getFileUrl(file.file_path);
        const fileResponse = await fetch(fileUrl);
        
        return new Response(fileResponse.body, {
          headers: {
            'Content-Type': fileResponse.headers.get('Content-Type') || 'application/octet-stream',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        console.error('File fetch error:', error);
        return new Response('Failed to fetch file', { status: 500 });
      }
    }

    // Serve the Mini App viewer (will be handled by Cloudflare Pages or static assets)
    if (url.pathname === '/view' || url.pathname.startsWith('/view/')) {
      return serveViewerPage(env.BOT_USERNAME);
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response('OK');
    }

    // Default: serve index/help page
    return new Response(getIndexHtml(env.BOT_USERNAME), {
      headers: { 'Content-Type': 'text/html' },
    });
  },
};

async function handleUpdate(update: TelegramUpdate, env: Env, baseUrl: string): Promise<void> {
  const api = new TelegramAPI(env.BOT_TOKEN);

  // Handle inline query
  if (update.inline_query) {
    await handleInlineQuery(api, update.inline_query, env.BUNDLES, env.BOT_USERNAME);
    return;
  }

  // Handle callback query
  if (update.callback_query) {
    await handleCallbackQuery(api, update.callback_query, env.BUNDLES);
    return;
  }

  // Handle message
  const msg = update.message;
  if (!msg) return;

  // Only handle private chats
  if (msg.chat.type !== 'private') return;

  const text = msg.text || '';

  // Handle commands
  if (text.startsWith('/start')) {
    await handleStartCommand(api, msg, env.BUNDLES, env.BOT_USERNAME);
    return;
  }

  if (text === '/done') {
    await handleDoneCommand(api, msg, env.BUNDLES, env.BOT_USERNAME, baseUrl);
    return;
  }

  if (text === '/cancel') {
    await handleCancelCommand(api, msg, env.BUNDLES);
    return;
  }

  if (text === '/help') {
    await handleHelpCommand(api, msg, env.BOT_USERNAME);
    return;
  }

  // Handle forwarded messages
  if (msg.forward_from || msg.forward_from_chat || msg.forward_sender_name || msg.forward_date) {
    await handleForwardedMessage(api, msg, env.BUNDLES);
    return;
  }

  // Handle regular messages during session (treat as content to bundle)
  if (msg.text || msg.photo || msg.document || msg.video || msg.audio || msg.voice || msg.sticker || msg.animation) {
    // Check if user has an active session
    const sessionData = await env.BUNDLES.get(`session:${msg.from!.id}`);
    if (sessionData) {
      await handleForwardedMessage(api, msg, env.BUNDLES);
    }
  }
}

function serveViewerPage(botUsername: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Messages Bundle Viewer</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--tg-theme-bg-color, #ffffff);
      color: var(--tg-theme-text-color, #000000);
      min-height: 100vh;
      padding: 16px;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--tg-theme-hint-color, #999999);
    }
    
    .header h1 {
      font-size: 20px;
      margin-bottom: 4px;
    }
    
    .header .meta {
      font-size: 14px;
      color: var(--tg-theme-hint-color, #999999);
    }
    
    .date-group {
      margin-bottom: 24px;
    }
    
    .date-header {
      text-align: center;
      margin-bottom: 12px;
    }
    
    .date-header span {
      background: var(--tg-theme-secondary-bg-color, #f0f0f0);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 13px;
      color: var(--tg-theme-hint-color, #999999);
    }
    
    .sender-group {
      margin-bottom: 16px;
    }
    
    .sender-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--tg-theme-link-color, #3390ec);
      margin-bottom: 6px;
      padding-left: 12px;
    }
    
    .message {
      background: var(--tg-theme-secondary-bg-color, #f0f0f0);
      padding: 10px 14px;
      border-radius: 16px;
      margin-bottom: 4px;
      max-width: 85%;
      word-wrap: break-word;
    }
    
    .message-text {
      font-size: 15px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    
    .message-media {
      margin-top: 8px;
    }
    
    .message-media img {
      max-width: 100%;
      border-radius: 8px;
    }
    
    .message-time {
      font-size: 11px;
      color: var(--tg-theme-hint-color, #999999);
      text-align: right;
      margin-top: 4px;
    }
    
    .media-placeholder {
      background: var(--tg-theme-button-color, #3390ec);
      color: var(--tg-theme-button-text-color, #ffffff);
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--tg-theme-hint-color, #999999);
    }
    
    .error {
      text-align: center;
      padding: 40px;
      color: #ff3b30;
    }
  </style>
</head>
<body>
  <div class="container" id="app">
    <div class="loading">Loading...</div>
  </div>
  
  <script>
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    
    const bundleId = tg.initDataUnsafe?.start_param || new URLSearchParams(window.location.search).get('startapp');
    
    if (!bundleId) {
      document.getElementById('app').innerHTML = '<div class="error">No bundle ID provided</div>';
    } else {
      loadBundle(bundleId);
    }
    
    async function loadBundle(id) {
      try {
        const response = await fetch('/api/bundle/' + id);
        if (!response.ok) {
          throw new Error('Bundle not found');
        }
        const bundle = await response.json();
        renderBundle(bundle);
      } catch (error) {
        document.getElementById('app').innerHTML = '<div class="error">' + error.message + '</div>';
      }
    }
    
    function formatDate(timestamp) {
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    function formatTime(timestamp) {
      const date = new Date(timestamp * 1000);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    function getSenderName(msg) {
      if (msg.forward_from) {
        return [msg.forward_from.first_name, msg.forward_from.last_name].filter(Boolean).join(' ');
      }
      if (msg.forward_from_chat) {
        return msg.forward_from_chat.title || 'Unknown Chat';
      }
      if (msg.forward_sender_name) {
        return msg.forward_sender_name;
      }
      if (msg.from) {
        return [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
      }
      return 'Unknown';
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function renderBundle(bundle) {
      // Group by date
      const dateGroups = {};
      
      for (const msg of bundle.messages) {
        const timestamp = msg.forward_date || msg.date;
        const dateKey = formatDate(timestamp);
        
        if (!dateGroups[dateKey]) {
          dateGroups[dateKey] = [];
        }
        dateGroups[dateKey].push(msg);
      }
      
      let html = '<div class="header">';
      html += '<h1>📦 Messages Bundle</h1>';
      html += '<div class="meta">' + bundle.messages.length + ' messages • Shared by ' + escapeHtml(bundle.creator_name) + '</div>';
      html += '</div>';
      
      for (const [date, messages] of Object.entries(dateGroups)) {
        html += '<div class="date-group">';
        html += '<div class="date-header"><span>' + date + '</span></div>';
        
        // Group by sender
        let currentSender = null;
        let senderMessages = [];
        
        for (const msg of messages) {
          const sender = getSenderName(msg);
          if (sender !== currentSender) {
            if (currentSender !== null) {
              html += renderSenderGroup(currentSender, senderMessages);
            }
            currentSender = sender;
            senderMessages = [msg];
          } else {
            senderMessages.push(msg);
          }
        }
        
        if (currentSender !== null) {
          html += renderSenderGroup(currentSender, senderMessages);
        }
        
        html += '</div>';
      }
      
      document.getElementById('app').innerHTML = html;
    }
    
    function renderSenderGroup(sender, messages) {
      let html = '<div class="sender-group">';
      html += '<div class="sender-name">' + escapeHtml(sender) + '</div>';
      
      for (const msg of messages) {
        html += renderMessage(msg);
      }
      
      html += '</div>';
      return html;
    }
    
    function renderMessage(msg) {
      const timestamp = msg.forward_date || msg.date;
      let html = '<div class="message">';
      
      // Text content
      const text = msg.text || msg.caption || '';
      if (text) {
        html += '<div class="message-text">' + escapeHtml(text) + '</div>';
      }
      
      // Media
      if (msg.photo && msg.photo.length > 0) {
        const photo = msg.photo[0];
        html += '<div class="message-media"><img src="/api/file/' + photo.file_id + '" alt="Photo" loading="lazy"></div>';
      }
      
      if (msg.sticker) {
        html += '<div class="media-placeholder">🎨 Sticker ' + (msg.sticker.emoji || '') + '</div>';
      }
      
      if (msg.document) {
        html += '<div class="media-placeholder">📎 ' + escapeHtml(msg.document.file_name || 'Document') + '</div>';
      }
      
      if (msg.video) {
        html += '<div class="media-placeholder">🎬 Video</div>';
      }
      
      if (msg.audio) {
        html += '<div class="media-placeholder">🎵 ' + escapeHtml(msg.audio.title || 'Audio') + '</div>';
      }
      
      if (msg.voice) {
        html += '<div class="media-placeholder">🎤 Voice message</div>';
      }
      
      if (msg.animation) {
        html += '<div class="media-placeholder">🎞 GIF</div>';
      }
      
      html += '<div class="message-time">' + formatTime(timestamp) + '</div>';
      html += '</div>';
      
      return html;
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

function getIndexHtml(botUsername: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Messages Bundler Bot</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 { color: #0088cc; }
    a { color: #0088cc; }
    .btn {
      display: inline-block;
      background: #0088cc;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      margin-top: 20px;
    }
    .btn:hover { background: #006699; }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>📦 Messages Bundler Bot</h1>
  <p>Bundle and share multiple forwarded Telegram messages in a single view.</p>
  
  <h2>How to use:</h2>
  <ol>
    <li>Send <code>/start</code> to the bot</li>
    <li>Forward messages you want to bundle</li>
    <li>Send <code>/done</code> to create the bundle</li>
    <li>Share using inline mode or the preview link</li>
  </ol>
  
  <a href="https://t.me/${botUsername}" class="btn">Open Bot</a>
</body>
</html>`;
}
