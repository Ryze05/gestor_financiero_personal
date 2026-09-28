import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { api } from './api.js';

function createServer(): McpServer {
  const server = new McpServer({ name: 'finanzas-mcp', version: '0.1.0' });

  server.registerTool(
    'list_categories',
    {
      description:
        'Lista las categorías disponibles para clasificar gastos e ingresos. Usa el id y el type de cada categoría.',
      inputSchema: z.object({}),
    },
    async () => {
      const data = await api.get('/categories?limit=100');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    'list_accounts',
    {
      description:
        'Lista las cuentas disponibles (solo activas) con su moneda y saldo actual. Útil para resolver accountId.',
      inputSchema: z.object({}),
    },
    async () => {
      const data = await api.get('/accounts?limit=100');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    'list_transactions',
    {
      description:
        'Lista movimientos con filtros opcionales. Para rangos de fechas usa from/to en formato YYYY-MM-DD. ' +
        'page/limit para paginación (máx 100).',
      inputSchema: z.object({
        from: z.string().describe('YYYY-MM-DD, inicio del rango').optional(),
        to: z.string().describe('YYYY-MM-DD, fin del rango').optional(),
        type: z.enum(['EXPENSE', 'INCOME']).optional(),
        search: z.string().describe('Texto a buscar en el concepto').optional(),
        minAmount: z.number().min(0).optional(),
        maxAmount: z.number().min(0).optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async (args) => {
      const qs = new URLSearchParams(
        Object.entries(args)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      const data = await api.get(`/transactions${qs ? `?${qs}` : ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    'list_transfers',
    {
      description:
        'Lista transferencias con filtros opcionales. Para rangos de fechas usa from/to en formato YYYY-MM-DD.',
      inputSchema: z.object({
        from: z.string().describe('YYYY-MM-DD, inicio del rango').optional(),
        to: z.string().describe('YYYY-MM-DD, fin del rango').optional(),
        search: z.string().describe('Texto a buscar en el concepto').optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async (args) => {
      const qs = new URLSearchParams(
        Object.entries(args)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      const data = await api.get(`/transfers${qs ? `?${qs}` : ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    'get_dashboard',
    {
      description:
        'Resumen de un periodo para una cuenta: ingresos, gastos, balance y desglose por categoría.',
      inputSchema: z.object({
        accountId: z.string().uuid(),
        from: z.string().describe('YYYY-MM-DD').optional(),
        to: z.string().describe('YYYY-MM-DD').optional(),
      }),
    },
    async ({ accountId, from, to }) => {
      const qs = new URLSearchParams({ accountId });
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const data = await api.get(`/dashboard?${qs.toString()}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    'create_transaction',
    {
      description:
        'Registra un gasto o ingreso con source=OPENCLAW. REQUIERE confirmación humana ANTES de invocarlo. ' +
        'externalId debe ser determinista (p.ej. ticket-20260925-001): si ya existe, devuelve el movimiento sin duplicar.',
      inputSchema: z.object({
        type: z.enum(['EXPENSE', 'INCOME']),
        amount: z.number().positive().describe('Importe, máximo 2 decimales'),
        currency: z.enum(['EUR', 'USD']),
        concept: z.string().min(1).max(150),
        date: z.string().describe('YYYY-MM-DD'),
        categoryId: z.string().uuid(),
        accountId: z.string().uuid(),
        notes: z.string().max(500).optional(),
        externalId: z.string().min(3).max(160),
      }),
    },
    async (args) => {
      const data = await api.post('/transactions', { ...args, source: 'OPENCLAW' });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    'create_transfer',
    {
      description:
        'Registra una transferencia entre dos cuentas distintas y activas. REQUIERE confirmación humana ANTES de invocarlo. ' +
        'La conversión entre monedas se calcula en el backend según la moneda de cada cuenta.',
      inputSchema: z.object({
        amount: z.number().positive().describe('Importe, máximo 2 decimales'),
        date: z.string().describe('YYYY-MM-DD'),
        sourceAccountId: z.string().uuid(),
        destinationAccountId: z.string().uuid(),
        concept: z.string().min(1).max(150).optional(),
      }),
    },
    async (args) => {
      const data = await api.post('/transfers', args);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  return server;
}

void serveStdio(createServer);
console.error('finanzas-mcp server en stdio');