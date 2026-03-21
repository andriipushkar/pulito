/**
 * Generate OpenAPI JSON file with auto-discovered routes.
 * Merges manually documented endpoints from swagger.ts with
 * auto-discovered routes from the filesystem.
 *
 * Usage: npx tsx scripts/generate-openapi.ts
 */

import { writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, relative } from 'path';

const API_DIR = resolve(__dirname, '../src/app/api/v1');
const OUTPUT_PATH = resolve(__dirname, '../public/openapi.json');

// HTTP methods exported from Next.js route handlers
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

interface RouteInfo {
  path: string;
  methods: string[];
  tag: string;
  isAdmin: boolean;
  isCron: boolean;
}

/**
 * Recursively scan directory for route.ts files (excluding test files).
 */
function scanRoutes(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...scanRoutes(fullPath));
    } else if (entry === 'route.ts' && !fullPath.includes('.test.')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Convert filesystem path to OpenAPI path.
 * e.g., /src/app/api/v1/admin/orders/[id]/status/route.ts -> /admin/orders/{id}/status
 */
function toApiPath(filePath: string): string {
  const rel = relative(API_DIR, filePath)
    .replace(/\/route\.ts$/, '')
    .replace(/\[([^\]]+)\]/g, '{$1}');

  return `/${rel}`;
}

/**
 * Detect exported HTTP methods from route file content.
 */
function detectMethods(filePath: string): string[] {
  // Read file and look for exported HTTP method handlers
  const content = require('fs').readFileSync(filePath, 'utf-8');
  const methods: string[] = [];

  for (const method of HTTP_METHODS) {
    // Match: export const GET, export async function GET, export function GET
    const pattern = new RegExp(`export\\s+(?:const|async\\s+function|function)\\s+${method}\\b`);
    if (pattern.test(content)) {
      methods.push(method.toLowerCase());
    }
  }

  return methods;
}

/**
 * Determine tag from path segments.
 */
function resolveTag(apiPath: string): string {
  const segments = apiPath.split('/').filter(Boolean);

  if (segments[0] === 'admin') {
    if (segments[1] === 'analytics') return 'Admin Analytics';
    if (segments[1] === 'loyalty') return 'Admin Loyalty';
    if (segments[1] === 'settings') return 'Admin Settings';
    return `Admin ${capitalize(segments[1] || '')}`;
  }
  if (segments[0] === 'cron') return 'Cron';
  if (segments[0] === 'webhooks') return 'Webhooks';
  if (segments[0] === 'auth') return 'Auth';
  if (segments[0] === 'me') return 'Profile';

  return capitalize(segments[0] || 'Other');
}

function capitalize(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generate a human-readable summary from the path.
 */
function generateSummary(apiPath: string, method: string): string {
  const segments = apiPath
    .split('/')
    .filter(Boolean)
    .filter((s) => !s.startsWith('{'));

  const resource = segments[segments.length - 1] || '';
  const hasId = apiPath.includes('{');

  const prefixes: Record<string, string> = {
    get: hasId ? 'Отримати' : 'Список',
    post: 'Створити',
    put: 'Оновити',
    patch: 'Оновити',
    delete: 'Видалити',
  };

  return `${prefixes[method] || method.toUpperCase()} ${resource.replace(/-/g, ' ')}`;
}

async function main() {
  // Load manually documented endpoints
  const { openApiDocument } = await import('../src/lib/swagger');

  // Discover all routes
  const routeFiles = scanRoutes(API_DIR);
  const discovered: RouteInfo[] = [];

  for (const filePath of routeFiles) {
    const apiPath = toApiPath(filePath);
    const methods = detectMethods(filePath);
    const tag = resolveTag(apiPath);
    const isAdmin = apiPath.startsWith('/admin');
    const isCron = apiPath.startsWith('/cron');

    if (methods.length > 0) {
      discovered.push({ path: apiPath, methods, tag, isAdmin, isCron });
    }
  }

  // Merge: manual definitions take priority, auto-discovered fill gaps
  const manualPaths = openApiDocument.paths as Record<string, Record<string, unknown>>;
  const allPaths: Record<string, Record<string, unknown>> = { ...manualPaths };

  // Collect all tags
  const tagSet = new Set<string>(
    (openApiDocument.tags as Array<{ name: string }>).map((t) => t.name)
  );

  for (const route of discovered) {
    if (route.isCron) continue; // Skip internal cron endpoints from public docs

    const pathKey = route.path;

    if (!allPaths[pathKey]) {
      allPaths[pathKey] = {};
    }

    for (const method of route.methods) {
      // Don't override manually documented endpoints
      if (allPaths[pathKey][method]) continue;

      const entry: Record<string, unknown> = {
        tags: [route.tag],
        summary: generateSummary(pathKey, method),
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
        },
      };

      if (route.isAdmin) {
        entry.security = [{ bearerAuth: [] }];
      }

      // Add path parameters
      const paramMatches = pathKey.match(/\{(\w+)\}/g);
      if (paramMatches) {
        entry.parameters = paramMatches.map((p) => ({
          name: p.replace(/[{}]/g, ''),
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        }));
      }

      allPaths[pathKey][method] = entry;
      tagSet.add(route.tag);
    }
  }

  // Sort paths alphabetically
  const sortedPaths: Record<string, unknown> = {};
  for (const key of Object.keys(allPaths).sort()) {
    sortedPaths[key] = allPaths[key];
  }

  // Build final tags array
  const existingTagNames = new Set(
    (openApiDocument.tags as Array<{ name: string }>).map((t) => t.name)
  );
  const finalTags = [
    ...(openApiDocument.tags as Array<{ name: string; description?: string }>),
    ...[...tagSet]
      .filter((t) => !existingTagNames.has(t))
      .sort()
      .map((name) => ({ name, description: name })),
  ];

  const finalDoc = {
    ...openApiDocument,
    paths: sortedPaths,
    tags: finalTags,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(finalDoc, null, 2), 'utf-8');

  const manualCount = Object.keys(manualPaths).length;
  const totalCount = Object.keys(sortedPaths).length;
  const autoCount = totalCount - manualCount;

  console.log(`OpenAPI spec generated at: ${OUTPUT_PATH}`);
  console.log(`  Manual endpoints: ${manualCount}`);
  console.log(`  Auto-discovered:  ${autoCount}`);
  console.log(`  Total endpoints:  ${totalCount}`);
}

main().catch(console.error);
