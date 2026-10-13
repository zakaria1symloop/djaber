// API-04 (03 §18) — OpenAPI 3.0 document generated from the running Nest routes and their zod DTOs (`createZodDto` →
// `zodToOpenAPI` of nestjs-zod; no @nestjs/swagger decorators: the DTOs are zod, api-contract header) + a Postman v2.1
// collection derived from it. Responses are described by the envelope of api-contract §1.4 / §1.5 (`{ data, meta? }` /
// `{ error }`); payload types live in `@djaber/shared` (TypeScript), referenced by name in each description.
import { RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { zodToOpenAPI } from 'nestjs-zod';
import { API_SCOPE, API_SCOPES_BY_METHOD, IDEMPOTENT, IS_AUTHENTICATED_ONLY, IS_PLATFORM, IS_PUBLIC, PERMISSION, PLATFORM_PERMISSION } from '../../core/auth/decorators';

type Schema = Record<string, any>;
type Operation = Record<string, any>;
export type OpenApiDoc = { openapi: string; info: Schema; servers: Schema[]; tags: Schema[]; paths: Record<string, Record<string, Operation>>; components: Schema };

const METHODS: Record<number, string> = { [RequestMethod.GET]: 'get', [RequestMethod.POST]: 'post', [RequestMethod.PUT]: 'put', [RequestMethod.PATCH]: 'patch', [RequestMethod.DELETE]: 'delete' };
/** Development simulators and infrastructure routes are not part of the published API. */
const HIDDEN = [/^\/dev(\/|$)/, /^\/dev-payments/, /^\/api\/docs/, /^\/metrics/, /^\/files/];

const joinPath = (...parts: string[]) => `/${parts.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')}`;
const toOpenApiPath = (p: string) => p.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
const schemaOf = (type: unknown): Schema | null => {
  const t = type as { isZodDto?: boolean; schema?: unknown } | undefined;
  if (!t?.isZodDto || !t.schema) return null;
  try {
    return zodToOpenAPI(t.schema as never) as Schema;
  } catch {
    return { type: 'object' };
  }
};

const envelope = { type: 'object', properties: { data: {}, meta: { type: 'object' } } };
const errorBody = {
  type: 'object',
  properties: { error: { type: 'object', required: ['code', 'message', 'ref'], properties: { code: { type: 'string' }, message: { type: 'string' }, params: { type: 'object' }, fields: { type: 'object', additionalProperties: { type: 'string' } }, details: {}, ref: { type: 'string' } } } },
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- controller classes from Nest discovery
type Ctl = { metatype: Function };

/** Builds the document from the controllers known to the application (Nest `DiscoveryService.getControllers()`). */
export const buildOpenApi = (controllers: Ctl[], o: { serverUrl: string; version: string }): OpenApiDoc => {
  const paths: OpenApiDoc['paths'] = {};
  const tags = new Set<string>();
  for (const { metatype } of controllers) {
    if (!metatype?.prototype) continue;
    const base = (Reflect.getMetadata(PATH_METADATA, metatype) as string | string[] | undefined) ?? '';
    const bases = Array.isArray(base) ? base : [base];
    for (const name of Object.getOwnPropertyNames(metatype.prototype)) {
      if (name === 'constructor') continue;
      const handler = metatype.prototype[name];
      if (typeof handler !== 'function') continue;
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
      const method = METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as number];
      if (sub === undefined || !method) continue;
      const meta = <T>(key: string) => (Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, metatype)) as T | undefined;
      const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, metatype, name) ?? {}) as Record<string, { index: number; data?: string }>;
      const types = (Reflect.getMetadata('design:paramtypes', metatype.prototype, name) ?? []) as unknown[];
      for (const b of bases) {
        for (const s of Array.isArray(sub) ? sub : [sub]) {
          const route = joinPath(b, s);
          if (HIDDEN.some((re) => re.test(route))) continue;
          const tag = route.split('/')[1] ?? 'root';
          tags.add(tag);
          const op: Operation = { tags: [tag], operationId: `${metatype.name}_${name}`, parameters: [] as Schema[], responses: {} };
          const isPublic = !!meta<boolean>(IS_PUBLIC);
          const perm = meta<string>(PERMISSION);
          const platform = meta<string>(PLATFORM_PERMISSION) ?? (meta<boolean>(IS_PLATFORM) ? 'platform' : undefined);
          const authOnly = !!meta<boolean>(IS_AUTHENTICATED_ONLY);
          const explicitScope = Reflect.getMetadata(API_SCOPE, handler) as string | undefined;
          const byMethod = meta<{ read?: string; write?: string }>(API_SCOPES_BY_METHOD);
          const scope = explicitScope ?? (byMethod ? (method === 'get' ? byMethod.read : byMethod.write) : undefined);
          const idem = meta<{ required: boolean }>(IDEMPOTENT);
          const notes: string[] = [];
          if (isPublic) notes.push('Public (no authentication).');
          else if (platform) notes.push(`Platform admin: \`${platform}\` (2FA required).`);
          else if (authOnly) notes.push('Any authenticated user (no workspace).');
          else if (perm) notes.push(`Permission \`${perm}\`${scope ? `; API key scope \`${scope}\`` : '; not reachable with an API key (403 API_SCOPE_FORBIDDEN)'}.`);
          if (idem) notes.push(idem.required ? 'Header `Idempotency-Key` required.' : 'Header `Idempotency-Key` accepted.');
          op.summary = `${method.toUpperCase()} ${route}`;
          op.description = notes.join(' ');
          op.security = isPublic ? [] : scope ? [{ bearerAuth: [] }, { apiKey: [] }] : [{ bearerAuth: [] }];
          if (!isPublic && !platform && !authOnly) op.parameters.push({ $ref: '#/components/parameters/WorkspaceId' });
          if (idem) op.parameters.push({ name: 'Idempotency-Key', in: 'header', required: idem.required, schema: { type: 'string', format: 'uuid' } });
          for (const m of route.matchAll(/:([A-Za-z0-9_]+)/g)) op.parameters.push({ name: m[1], in: 'path', required: true, schema: { type: 'string' } });
          for (const [k, a] of Object.entries(args)) {
            const kind = Number(k.split(':')[0]);
            const sch = schemaOf(types[a.index]);
            if (kind === RouteParamtypes.BODY && sch) op.requestBody = { required: true, content: { 'application/json': { schema: sch } } };
            if (kind === RouteParamtypes.QUERY && sch?.properties) {
              const required = new Set<string>((sch.required as string[] | undefined) ?? []);
              for (const [qn, qs] of Object.entries(sch.properties as Record<string, Schema>)) op.parameters.push({ name: qn, in: 'query', required: required.has(qn), schema: qs });
            }
          }
          const code = String(Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200));
          op.responses[code] = code === '204' ? { description: 'No content' } : { description: 'Success envelope `{ data, meta? }` (api-contract §1.4)', content: { 'application/json': { schema: envelope } } };
          op.responses.default = { description: 'Error envelope (api-contract §1.5, codes of 11-error-catalogue)', content: { 'application/json': { schema: errorBody } } };
          const key = toOpenApiPath(route);
          paths[key] ??= {};
          paths[key]![method] = op;
        }
      }
    }
  }
  const sorted = Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)));
  return {
    openapi: '3.0.3',
    info: {
      title: 'Djaber API',
      version: o.version,
      description:
        'REST API of Djaber v2. Base path `/api/v1`. Users: `Authorization: Bearer <JWT>` + `X-Workspace-Id`. Integrations: `X-API-Key: dj_live_…` (scopes of 06 §5, 600 requests / min / key). Errors: `{ error: { code, message, params?, fields?, details?, ref } }`. Outbound webhooks are signed `X-Djaber-Signature: t=<unix>,v1=<hmac_sha256(secret, "t.body")>`.',
    },
    servers: [{ url: `${o.serverUrl.replace(/\/$/, '')}/api/v1` }],
    tags: [...tags].sort().map((name) => ({ name })),
    paths: sorted,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } },
      parameters: { WorkspaceId: { name: 'X-Workspace-Id', in: 'header', required: false, description: 'Workspace of the request (ignored for API keys)', schema: { type: 'string', format: 'uuid' } } },
    },
  };
};

/** Minimal example of a schema (Postman bodies). */
const example = (s: Schema | undefined, depth = 0): unknown => {
  if (!s || depth > 4) return null;
  if (s.example !== undefined) return s.example;
  if (s.default !== undefined) return s.default;
  if (Array.isArray(s.enum)) return s.enum[0];
  if (s.oneOf || s.anyOf) return example((s.oneOf ?? s.anyOf)[0], depth + 1);
  if (s.allOf) return example(s.allOf[0], depth + 1);
  switch (s.type) {
    case 'object':
      return Object.fromEntries(Object.entries((s.properties ?? {}) as Record<string, Schema>).filter(([k]) => ((s.required as string[] | undefined) ?? []).includes(k)).map(([k, v]) => [k, example(v, depth + 1)]));
    case 'array':
      return [];
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'string':
      return s.format === 'uuid' ? '00000000-0000-0000-0000-000000000000' : s.format === 'email' ? 'name@example.com' : '';
    default:
      return null;
  }
};

/** Postman Collection v2.1 — one folder per tag; variables `baseUrl`, `apiKey`, `token`, `workspaceId`. */
export const toPostman = (doc: OpenApiDoc) => {
  const folders = new Map<string, unknown[]>();
  for (const [path, ops] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      const raw = `{{baseUrl}}${path.replace(/\{([^}]+)\}/g, ':$1')}`;
      const headers: { key: string; value: string }[] = [];
      const security = (op.security as Schema[] | undefined) ?? [];
      if (security.some((x) => 'apiKey' in x)) headers.push({ key: 'X-API-Key', value: '{{apiKey}}' });
      else if (security.length) headers.push({ key: 'Authorization', value: 'Bearer {{token}}' });
      const params = (op.parameters as Schema[]).filter((p) => !p.$ref);
      if ((op.parameters as Schema[]).some((p) => p.$ref)) headers.push({ key: 'X-Workspace-Id', value: '{{workspaceId}}' });
      if (params.some((p) => p.name === 'Idempotency-Key')) headers.push({ key: 'Idempotency-Key', value: '{{$guid}}' });
      const body = op.requestBody?.content?.['application/json']?.schema;
      if (body) headers.push({ key: 'Content-Type', value: 'application/json' });
      const item = {
        name: op.summary,
        request: {
          method: method.toUpperCase(),
          header: headers,
          url: {
            raw,
            host: ['{{baseUrl}}'],
            path: path.split('/').filter(Boolean).map((p) => p.replace(/\{([^}]+)\}/, ':$1')),
            query: params.filter((p) => p.in === 'query').map((p) => ({ key: p.name, value: '', disabled: !p.required })),
            variable: params.filter((p) => p.in === 'path').map((p) => ({ key: p.name, value: '' })),
          },
          ...(body ? { body: { mode: 'raw', raw: JSON.stringify(example(body), null, 2), options: { raw: { language: 'json' } } } } : {}),
          description: op.description,
        },
      };
      const tag = (op.tags as string[])[0] ?? 'root';
      if (!folders.has(tag)) folders.set(tag, []);
      folders.get(tag)!.push(item);
    }
  }
  return {
    info: { name: 'Djaber API', description: doc.info.description, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    variable: [
      { key: 'baseUrl', value: doc.servers[0]?.url ?? '' },
      { key: 'apiKey', value: '' },
      { key: 'token', value: '' },
      { key: 'workspaceId', value: '' },
    ],
    item: [...folders.entries()].map(([name, item]) => ({ name, item })),
  };
};
