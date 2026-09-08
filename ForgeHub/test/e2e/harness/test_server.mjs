/**
 * Integrated Mock Test Server for ForgeHub E2E Testing Track
 * Pure Node.js standard library (node:http) implementing 100% of ForgeHub
 * REST APIs, SSE telemetry brokers, reverse proxy routing, and memory guard.
 */

import http from 'node:http';
import { URL } from 'node:url';

export class ForgeHubTestServer {
  constructor(port = 8888) {
    this.port = port;
    this.server = null;
    this.startTime = Date.now();
    this.simulatedFreeRamMb = 1220; // Default healthy RAM
    this.activeSSEConnections = new Set();

    // In-memory state
    this.state = {
      ap_active: true,
      provisioning: false,
      provision_phase: 'idle',
      client_connected: false,
      client_ip: '',
      client_ssid: '',
      ap_ssid: 'MultiForge-Setup-E10',
      ap_ip: '192.168.4.1',
      device_model: 'BTV Express E10 (Amlogic S905X2)',
      active_provision_job: null,
    };

    // Registered modules catalog
    this.modules = new Map([
      [
        'mina-ia',
        {
          id: 'mina-ia',
          name: 'Mina — Assistente Virtual Acadêmica',
          version: '1.0.0',
          type: 'systemd',
          category: 'ai',
          icon: 'bot',
          description: 'Quiosque de voz inteligente offline com PyQt5, Sherpa-ONNX e wake-word local.',
          port: 5000,
          proxy_path: '/app/mina-ia',
          min_ram_mb: 256,
          min_disk_mb: 300,
          tier: 'stable',
          author: 'G.E.R.A — UNESP Sorocaba',
          status: 'stopped',
        },
      ],
      [
        'web-scraping',
        {
          id: 'web-scraping',
          name: 'Coletor Acadêmico & RAG Agent',
          version: '1.0.0',
          type: 'compose',
          category: 'data',
          icon: 'database',
          description: 'Pipeline assíncrono de coleta e RAG com FastAPI, PostgreSQL e Redis.',
          port: 8000,
          proxy_path: '/app/web-scraping',
          min_ram_mb: 512,
          min_disk_mb: 600,
          tier: 'stable',
          author: 'G.E.R.A — UNESP Sorocaba',
          status: 'stopped',
        },
      ],
    ]);

    // Reverse proxy routes table: pathPrefix -> { module_id, target_url, strip_prefix }
    this.proxyRoutes = new Map();
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(this.port, '127.0.0.1', () => {
        resolve(`http://127.0.0.1:${this.port}`);
      });
      this.server.on('error', reject);
    });
  }

  stop() {
    return new Promise((resolve) => {
      // Terminate all SSE connections cleanly
      for (const sseRes of this.activeSSEConnections) {
        try {
          sseRes.end();
        } catch (_) {}
      }
      this.activeSSEConnections.clear();

      if (this.server) {
        if (typeof this.server.closeAllConnections === 'function') {
          this.server.closeAllConnections();
        }
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  // --- Helper Methods ---

  sendJSON(res, statusCode, data, headers = {}) {
    // P0 Security Redaction: recursively sanitize sensitive fields
    const sanitized = this.redactSecrets(data);
    const jsonStr = JSON.stringify(sanitized);

    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Debug-Simulate-Memory',
      ...headers,
    });
    res.end(jsonStr);
  }

  redactSecrets(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactSecrets(item));
    }

    const copy = {};
    const sensitiveRegex = /^(password|psk|secret|passphrase|private_key)$/i;

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveRegex.test(key) && typeof value === 'string' && value !== '') {
        copy[key] = '***';
      } else if (typeof value === 'object') {
        copy[key] = this.redactSecrets(value);
      } else {
        copy[key] = value;
      }
    }
    return copy;
  }

  async parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) {
          req.destroy();
          reject(new Error('Body too large'));
        }
      });
      req.on('end', () => {
        if (!body.trim()) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  getSimulatedFreeRam(req, query) {
    const headerVal = req.headers['x-debug-simulate-memory'];
    if (headerVal !== undefined) {
      const parsed = parseInt(headerVal, 10);
      if (!isNaN(parsed)) return parsed;
    }
    const queryVal = query.get('simulate_free_ram_mb');
    if (queryVal !== null) {
      const parsed = parseInt(queryVal, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return this.simulatedFreeRamMb;
  }

  // --- Main Request Dispatcher ---

  async handleRequest(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Debug-Simulate-Memory',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    try {
      // Dynamic Reverse Proxy Router: /app/{id}/*
      if (pathname.startsWith('/app/')) {
        return this.handleReverseProxy(req, res, pathname, parsedUrl);
      }

      // API Endpoints Router
      if (pathname === '/api/status') {
        if (method !== 'GET') {
          return this.sendJSON(res, 405, { error: 'method_not_allowed' });
        }
        return this.handleGetStatus(req, res);
      }

      if (pathname === '/api/metrics') {
        if (method !== 'GET') {
          return this.sendJSON(res, 405, { error: 'method_not_allowed' });
        }
        return this.handleGetMetrics(req, res, parsedUrl.searchParams);
      }

      if (pathname === '/api/events') {
        return this.handleGetEvents(req, res);
      }

      if (pathname === '/api/scan') {
        if (method !== 'GET') {
          return this.sendJSON(res, 405, { error: 'method_not_allowed' });
        }
        return this.handleGetScan(req, res);
      }

      if (pathname === '/api/ap') {
        return this.sendJSON(res, 200, {
          ssid: this.state.ap_ssid,
          channel: 6,
          ip: this.state.ap_ip,
        });
      }

      if (pathname === '/api/provision') {
        if (method !== 'POST') {
          return this.sendJSON(res, 405, { error: 'method_not_allowed' });
        }
        return await this.handlePostProvision(req, res);
      }

      if (pathname === '/api/reset') {
        if (method !== 'POST') {
          return this.sendJSON(res, 405, { error: 'method_not_allowed' });
        }
        return await this.handlePostReset(req, res);
      }

      if (pathname === '/api/store') {
        return this.handleGetStore(req, res);
      }

      if (pathname === '/api/modules') {
        return this.handleGetModules(req, res);
      }

      if (pathname.startsWith('/api/modules/')) {
        return this.handleModuleSubroutes(req, res, pathname);
      }

      if (pathname === '/api/services') {
        return this.sendJSON(res, 200, {
          services: [
            { name: 'forgehub.service', active: true, status: 'active' },
            { name: 'forge-kiosk.service', active: true, status: 'active' },
            { name: 'forge-watchdog.service', active: true, status: 'active' },
          ],
        });
      }

      // Static SPA Fallback for non-API routes
      return this.handleSPAFallback(req, res);
    } catch (err) {
      if (err.name === 'SyntaxError') {
        return this.sendJSON(res, 400, { error: 'invalid_json', message: 'Malformed JSON payload' });
      }
      return this.sendJSON(res, 500, { error: 'internal_error', message: err.message });
    }
  }

  // --- Handlers ---

  handleGetStatus(req, res) {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const status = {
      ap_active: this.state.ap_active,
      provisioning: this.state.provisioning,
      client_connected: this.state.client_connected,
      client_ip: this.state.client_ip,
      client_ssid: this.state.client_ssid,
      ap_ssid: this.state.ap_ssid,
      ap_ip: this.state.ap_ip,
      device_model: this.state.device_model,
      uptime: uptimeSec,
      free_ram_mb: this.simulatedFreeRamMb,
    };
    this.sendJSON(res, 200, status);
  }

  handleGetMetrics(req, res, query) {
    const freeRam = this.getSimulatedFreeRam(req, query);
    const totalRam = 1805;
    const usedRam = Math.max(0, totalRam - freeRam);

    const metrics = {
      cpu_percent: 5.4,
      ram_total_mb: totalRam,
      ram_used_mb: usedRam,
      ram_free_mb: freeRam,
      temp_celsius: 48.5,
      disk_total_gb: 7.2,
      disk_used_gb: 3.1,
      disk_free_gb: 4.1,
      net_rx_kbps: 12.4,
      net_tx_kbps: 8.1,
      timestamp: Date.now(),
    };
    this.sendJSON(res, 200, metrics);
  }

  handleGetEvents(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    this.activeSSEConnections.add(res);

    // Immediate initial telemetry event
    const emitTelemetry = () => {
      const freeRam = this.simulatedFreeRamMb;
      const totalRam = 1805;
      const metrics = {
        cpu_percent: 5.0 + Math.random() * 2.0,
        ram_total_mb: totalRam,
        ram_used_mb: totalRam - freeRam,
        ram_free_mb: freeRam,
        temp_celsius: 48.0 + Math.random(),
        timestamp: Date.now(),
      };
      res.write(`event: telemetry\ndata: ${JSON.stringify(metrics)}\n\n`);
    };

    emitTelemetry();

    const intervalId = setInterval(emitTelemetry, 1000);

    req.on('close', () => {
      clearInterval(intervalId);
      this.activeSSEConnections.delete(res);
    });
  }

  handleGetScan(req, res) {
    const networks = [
      { ssid: 'UNESP_Visitantes', bssid: '00:11:22:33:44:55', rssi: -55, channel: 6, encryption: 'psk' },
      { ssid: 'eduroam', bssid: 'AA:BB:CC:DD:EE:FF', rssi: -62, channel: 1, encryption: 'eap' },
      { ssid: 'MultiForge_Lab', bssid: '11:22:33:44:55:66', rssi: -48, channel: 11, encryption: 'psk' },
      { ssid: 'Open_Wifi', bssid: '22:33:44:55:66:77', rssi: -72, channel: 1, encryption: 'open' },
    ];
    this.sendJSON(res, 200, { networks });
  }

  async handlePostProvision(req, res) {
    let body;
    try {
      body = await this.parseBody(req);
    } catch (err) {
      return this.sendJSON(res, 400, { error: 'invalid_json', message: 'Corpo da requisição não é um JSON válido' });
    }
    const { ssid, password, type = 'psk', identity } = body;

    // Validation
    if (!ssid || typeof ssid !== 'string' || ssid.trim() === '') {
      return this.sendJSON(res, 400, { error: 'validation_error', message: 'ssid obrigatorio' });
    }

    // Special control character rejection
    if (/[\n\r\t]/.test(ssid)) {
      return this.sendJSON(res, 400, { error: 'invalid_ssid', message: 'SSID contem caracteres invalidos' });
    }

    if (type === 'psk' && password !== undefined && password !== '') {
      // 64-hex key is allowed
      const isHex64 = /^[0-9a-fA-F]{64}$/.test(password);
      if (!isHex64 && (password.length < 8 || password.length > 63)) {
        return this.sendJSON(res, 400, {
          error: 'invalid_password',
          message: 'senha PSK deve ter 8-63 caracteres',
        });
      }
    }

    if (type === 'eap' && (!identity || identity.trim() === '')) {
      return this.sendJSON(res, 400, {
        error: 'missing_identity',
        message: 'identidade e senha obrigatorias',
      });
    }

    if (this.state.provisioning && type !== 'eap') {
      return this.sendJSON(res, 409, {
        error: 'conflict',
        message: 'provisionamento em andamento',
      });
    }

    // Initiate provisioning state
    this.state.provisioning = true;
    this.state.provision_phase = 'assoc';
    this.state.client_ssid = ssid;

    // Simulate connection failure and rollback if invalid network requested
    if (ssid === 'invalid-network' || ssid === 'fail-assoc') {
      setTimeout(() => {
        this.state.provisioning = false;
        this.state.provision_phase = 'failed';
        this.state.ap_active = true;
      }, 500);
    } else {
      setTimeout(() => {
        this.state.provisioning = false;
        this.state.provision_phase = 'connected';
        this.state.client_connected = true;
        this.state.client_ip = '192.168.1.150';
      }, 500);
    }

    this.sendJSON(res, 200, {
      ok: true,
      status: 'applying',
      timeout_sec: 60,
      message: 'Provisioning queued with 60s auto-rollback to AP mode on failure',
    });
  }

  handlePostReset(req, res) {
    this.state.provisioning = false;
    this.state.provision_phase = 'idle';
    this.state.client_connected = false;
    this.state.client_ip = '';
    this.state.client_ssid = '';
    this.state.ap_active = true;

    this.sendJSON(res, 200, {
      ok: true,
      status: 'restored_to_ap',
      message: 'Reset to AP mode initiated',
    });
  }

  handleGetStore(req, res) {
    const catalog = Array.from(this.modules.values()).map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      type: m.type,
      category: m.category,
      icon: m.icon,
      description: m.description,
      min_ram_mb: m.min_ram_mb,
      min_disk_mb: m.min_disk_mb,
      tier: m.tier,
      author: m.author,
    }));
    this.sendJSON(res, 200, { catalog });
  }

  handleGetModules(req, res) {
    const modules = Array.from(this.modules.values());
    this.sendJSON(res, 200, { modules });
  }

  async handleModuleSubroutes(req, res, pathname) {
    const parts = pathname.replace('/api/modules/', '').split('/');
    const id = decodeURIComponent(parts[0]);
    const action = parts[1];

    const module = this.modules.get(id);
    if (!module) {
      return this.sendJSON(res, 404, { error: 'not_found', message: 'module not found' });
    }

    if (!action) {
      if (req.method === 'GET') {
        return this.sendJSON(res, 200, module);
      }
      return this.sendJSON(res, 405, { error: 'method_not_allowed' });
    }

    if (action === 'start') {
      if (req.method !== 'POST') return this.sendJSON(res, 405, { error: 'method_not_allowed' });

      // Pre-Flight Memory Guard check (< 300 MB)
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const freeRam = this.getSimulatedFreeRam(req, parsedUrl.searchParams);

      if (freeRam < 300) {
        return this.sendJSON(res, 422, {
          error: 'preflight_memory_guard',
          code: 'INSUFFICIENT_MEMORY',
          message: 'Operação bloqueada: Memória RAM livre insuficiente (< 300 MB).',
          available_ram_mb: freeRam,
          threshold_mb: 300,
        });
      }

      // Check if module requirement exceeds free RAM
      if (module.min_ram_mb > freeRam) {
        return this.sendJSON(res, 422, {
          error: 'insufficient_module_ram',
          code: 'INSUFFICIENT_MEMORY',
          message: `Module requires ${module.min_ram_mb} MB but only ${freeRam} MB available`,
          available_ram_mb: freeRam,
          required_ram_mb: module.min_ram_mb,
        });
      }

      module.status = 'running';
      // Auto-register reverse proxy route
      this.proxyRoutes.set(module.proxy_path || `/app/${id}`, {
        module_id: id,
        target_url: `http://127.0.0.1:${module.port}`,
        strip_prefix: true,
      });

      return this.sendJSON(res, 200, { ok: true, status: 'running' });
    }

    if (action === 'stop') {
      if (req.method !== 'POST') return this.sendJSON(res, 405, { error: 'method_not_allowed' });
      module.status = 'stopped';
      // Auto-deregister reverse proxy route
      this.proxyRoutes.delete(module.proxy_path || `/app/${id}`);
      return this.sendJSON(res, 200, { ok: true, status: 'stopped' });
    }

    if (action === 'register') {
      if (req.method !== 'POST') return this.sendJSON(res, 405, { error: 'method_not_allowed' });
      const body = await this.parseBody(req);
      const { proxy_path, target_url } = body;

      if (!proxy_path || !target_url) {
        return this.sendJSON(res, 400, {
          error: 'bad_request',
          message: 'proxy_path and target_url required',
        });
      }

      // Collision check
      const cleanPath = '/' + proxy_path.replace(/^\/+|\/+$/g, '');
      const existing = this.proxyRoutes.get(cleanPath);
      if (existing && existing.module_id !== id) {
        return this.sendJSON(res, 409, {
          error: 'route_collision',
          message: `Route '${cleanPath}' is already registered to module '${existing.module_id}'`,
        });
      }

      this.proxyRoutes.set(cleanPath, {
        module_id: id,
        target_url,
        strip_prefix: true,
      });

      return this.sendJSON(res, 200, { ok: true, registered: cleanPath });
    }

    if (action === 'deregister') {
      if (req.method !== 'POST') return this.sendJSON(res, 405, { error: 'method_not_allowed' });
      let removed = false;
      for (const [routePath, meta] of this.proxyRoutes.entries()) {
        if (meta.module_id === id) {
          this.proxyRoutes.delete(routePath);
          removed = true;
        }
      }
      return this.sendJSON(res, 200, { ok: true, deregistered: removed });
    }

    if (action === 'logs' && parts[2] === 'stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      res.write(`event: log\ndata: \x1b[32m[INFO]\x1b[0m Service ${id} initialization\n\n`);

      const logTimer = setInterval(() => {
        res.write(`event: log\ndata: \x1b[34m[DEBUG]\x1b[0m Running health check for ${id}\n\n`);
      }, 1000);

      req.on('close', () => {
        clearInterval(logTimer);
      });
      return;
    }

    return this.sendJSON(res, 404, { error: 'not_found' });
  }

  handleReverseProxy(req, res, pathname, parsedUrl) {
    // Find matching route prefix
    let matchedPrefix = null;
    let matchedRoute = null;

    for (const [prefix, route] of this.proxyRoutes.entries()) {
      if (pathname === prefix || pathname.startsWith(prefix + '/')) {
        matchedPrefix = prefix;
        matchedRoute = route;
        break;
      }
    }

    if (!matchedRoute) {
      // 503 Service Unavailable / 404 Not Found if route not found or module stopped
      return this.sendJSON(res, 503, {
        error: 'service_unavailable',
        message: 'Module is not running or route is unregistered',
        path: pathname,
      });
    }

    // Strip prefix for backend and preserve query string
    const queryStr = parsedUrl && parsedUrl.search ? parsedUrl.search : '';
    const strippedPath = (pathname.substring(matchedPrefix.length) || '/') + queryStr;

    // Mock response representing proxied backend application
    const proxyResponse = {
      proxied: true,
      module_id: matchedRoute.module_id,
      original_path: req.url,
      target_path: strippedPath,
      headers: {
        'X-Forwarded-Prefix': matchedPrefix,
        'X-Forwarded-Host': req.headers.host || 'localhost',
      },
    };

    this.sendJSON(res, 200, proxyResponse, {
      'X-Forwarded-Prefix': matchedPrefix,
      'X-Forwarded-Host': req.headers.host || 'localhost',
    });
  }

  handleSPAFallback(req, res) {
    const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <title>ForgeHub — Edge Appliance Manager</title>
</head>
<body class="bg-bg-base text-text-primary">
  <div id="root">ForgeHub SPA</div>
</body>
</html>`;

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(html);
  }
}

// Support direct invocation: `node test_server.mjs [port]`
if (process.argv[1]?.endsWith('test_server.mjs')) {
  const port = parseInt(process.argv[2] || '8888', 10);
  const server = new ForgeHubTestServer(port);
  server.start().then((url) => {
    console.log(`ForgeHub Test Server listening at ${url}`);
  });
}
