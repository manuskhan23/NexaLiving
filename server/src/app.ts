import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import morgan from 'morgan';
import { isProd } from './config/env';
import { globalLimiter } from './middleware/rateLimiters';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

const WELCOME_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>NexaLiving Backend</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;height:100%}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
    background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);
    color:#e2e8f0;
    min-height:100vh;
    display:flex;align-items:center;justify-content:center;
    padding:24px;
  }
  .card{
    max-width:640px;width:100%;
    background:rgba(15,23,42,.6);
    border:1px solid rgba(148,163,184,.18);
    border-radius:16px;
    padding:40px 36px;
    box-shadow:0 20px 60px rgba(0,0,0,.4);
    backdrop-filter:blur(10px);
  }
  .badge{
    display:inline-flex;align-items:center;gap:6px;
    background:rgba(16,185,129,.12);
    color:#34d399;
    padding:6px 14px;border-radius:999px;
    font-size:13px;font-weight:600;letter-spacing:.02em;
    border:1px solid rgba(16,185,129,.28);
  }
  .badge .dot{width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 12px #10b981}
  h1{
    margin:20px 0 8px;
    font-size:34px;font-weight:800;letter-spacing:-.02em;
    background:linear-gradient(90deg,#a5b4fc 0%,#60a5fa 50%,#34d399 100%);
    -webkit-background-clip:text;background-clip:text;
    -webkit-text-fill-color:transparent;color:transparent;
  }
  .sub{color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 28px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px}
  .stat{
    background:rgba(30,41,59,.55);
    border:1px solid rgba(148,163,184,.14);
    border-radius:10px;padding:14px 16px;
  }
  .stat .k{font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px}
  .stat .v{font-size:16px;color:#f1f5f9;font-weight:600;margin:0;word-break:break-all}
  .links{display:flex;flex-wrap:wrap;gap:10px}
  .links a{
    flex:1;min-width:160px;
    display:inline-flex;align-items:center;justify-content:center;gap:8px;
    padding:12px 18px;border-radius:10px;
    text-decoration:none;font-weight:600;font-size:14px;
    background:rgba(96,165,250,.14);
    color:#93c5fd;
    border:1px solid rgba(96,165,250,.28);
    transition:all .15s ease;
  }
  .links a:hover{background:rgba(96,165,250,.22);transform:translateY(-1px)}
  .links a.alt{background:rgba(52,211,153,.14);color:#6ee7b7;border-color:rgba(52,211,153,.28)}
  .links a.alt:hover{background:rgba(52,211,153,.22)}
  footer{margin-top:28px;padding-top:20px;border-top:1px solid rgba(148,163,184,.12);color:#64748b;font-size:12px;text-align:center}
  @media (max-width:520px){.grid{grid-template-columns:1fr}.card{padding:30px 22px}h1{font-size:26px}}
</style>
</head>
<body>
  <main class="card">
    <span class="badge"><span class="dot"></span>API Online</span>
    <h1>Welcome to NexaLiving Backend</h1>
    <p class="sub">Private neighbourhood community &amp; society management REST API. Built with Node.js, Express, TypeScript and MongoDB.</p>
    <div class="grid">
      <div class="stat"><p class="k">Version</p><p class="v">v1</p></div>
      <div class="stat"><p class="k">Base URL</p><p class="v">/api/v1</p></div>
      <div class="stat"><p class="k">Total Routes</p><p class="v">169</p></div>
      <div class="stat"><p class="k">Modules</p><p class="v">20</p></div>
    </div>
    <div class="links">
      <a href="/api/v1/health">Health Check</a>
      <a class="alt" href="/api/v1/meta/enums">Enumerations</a>
    </div>
    <footer>NexaLiving &middot; Secured with JWT &middot; AES-256-GCM encrypted assistance</footer>
  </main>
</body>
</html>`;

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // Mobile-app backend: no browser clients, so CORS is intentionally not enabled.
  // CSP disabled so the inline-styled welcome page at `/` can render.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(mongoSanitize());
  app.use(hpp());
  if (!isProd) app.use(morgan('dev'));
  // Legacy images saved on disk are served only while server/uploads exists:
  // run `npm run migrate:uploads:imagekit -- --apply`, then delete the folder.
  const legacyUploads = path.join(process.cwd(), 'uploads');
  if (fs.existsSync(legacyUploads)) app.use('/uploads', express.static(legacyUploads));
  app.use('/api/v1', globalLimiter, routes);
  app.get('/', (_req, res) => {
    res.status(200).type('html').send(WELCOME_HTML);
  });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
export default app;
