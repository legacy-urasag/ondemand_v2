# OnDemand Platform

Production-ready home services platform for verified handymen and contractors in Budapest, featuring robust backend security, full SEO optimization, multi-tier rate limiting, JWT & RBAC authentication, strict CORS, and comprehensive Zod form validation.

---

## Architecture Overview

```
OnDemand Platform
├── public/                 # Static assets and SEO files
│   ├── index.html          # High-performance landing page with full SEO & client validation
│   ├── robots.txt          # Crawler directives & sitemap location
│   └── sitemap.xml         # XML sitemap with all core pages and service landing pages
├── src/
│   ├── config/
│   │   └── env.ts          # Validated environment configuration with Zod
│   ├── shared/
│   │   └── schemas.ts      # Shared universal Zod schemas (forms, auth, params)
│   ├── middleware/
│   │   ├── rateLimiter.ts  # Tiered sliding-window rate limiter (memory + distributed Redis adapter)
│   │   ├── auth.ts         # JWT authentication and Role-Based Access Control (RBAC)
│   │   ├── cors.ts         # Strict origin, credentials, and preflight CORS management
│   │   ├── validate.ts     # Zod request validation middleware
│   │   └── errorHandler.ts # Secure, structured global error and 404 handlers
│   ├── routes/
│   │   ├── public.ts       # Public APIs (/api/health, /api/services, /api/forms/*)
│   │   ├── auth.ts         # Authentication routes (/api/auth/login, /api/auth/me)
│   │   ├── admin.ts        # Protected management routes with IDOR protection
│   │   └── seo.ts          # Dynamic robots.txt, sitemap.xml, and SEO metadata endpoints
│   ├── services/
│   │   ├── authService.ts  # PBKDF2 password hashing with salt & native JWT signing
│   │   └── submissionService.ts # Leads and applications data layer
│   ├── server.ts           # Express application setup
│   └── index.ts            # Entrypoint with graceful shutdown
└── tests/
    ├── backend/            # Unit and integration tests (auth, validation, rateLimit, CORS, routes)
    └── e2e/                # End-to-end smoke test suite
```

---

## 1. Full SEO Implementation

- **Head Metadata**: Clean Hungarian page titles, descriptive meta tags, viewport settings, format detection.
- **Canonical URLs**: Strict canonical link tags configured (`https://ondemand.hu/`).
- **Open Graph & Twitter**: Complete `og:type`, `og:site_name`, `og:title`, `og:description`, `og:image`, `og:url`, `og:locale`, and Twitter summary cards.
- **Structured Data (JSON-LD)**:
  - `HomeAndConstructionBusiness`: Local business schema with address, service areas, ratings, and service catalog.
  - `BreadcrumbList`: Structured breadcrumb hierarchy for search engine indexing.
- **Robots & Sitemap**:
  - `robots.txt`: Allows public indexing while disallowing `/api/` and `/admin/`.
  - `sitemap.xml`: Automatically updated XML sitemap with daily/weekly change frequencies and dedicated crawlable service URLs (`/szolgaltatasok/:slug`) with Hungarian accent transliteration.

---

## 2. Rate Limiting on Public APIs

The platform implements a multi-tier sliding-window rate limiter with standard HTTP headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`) returning `429 Too Many Requests`.

| Endpoint Category | Window | Limit | Sensitivity | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** (`/api/auth/login`) | 15 mins | 5 reqs / IP | High | Brute-force & credential stuffing defense |
| **Form Submissions** (`/api/forms/*`) | 15 mins | 15 reqs / IP | Medium | Spam, abuse, and flooding prevention |
| **General Public** (`/api/health`, `/api/services`) | 15 mins | 100 reqs / IP | Low | DoS and scraping prevention |

### Production Multi-Instance Support

By default, an active in-memory sliding window store with automatic periodic garbage collection is used.
For clustered or multi-instance deployments (e.g. Kubernetes, multi-dyno), set:

```env
RATE_LIMIT_STORAGE=redis
REDIS_URL=redis://localhost:6379
```

---

## 3. Authentication & Authorization for Non-Public APIs

- **Password Hashing**: Zero-external-dependency PBKDF2 hashing using native `crypto.pbkdf2Sync` with 100,000 iterations, SHA-512, unique 16-byte cryptographically secure salts, and constant-time verification (`crypto.timingSafeEqual`).
- **Token Security**: Native HMAC SHA-256 JWT tokens with expiration verification.
- **Role-Based Access Control (RBAC)**:
  - `admin`: Full system access (view inquiries, applications, update statuses, manage settings).
  - `operator`: Access to review submissions and update verification statuses.
  - `viewer`: Read-only access to submissions.
- **Insecure Direct Object Reference (IDOR) Mitigation**: All object IDs are strictly validated using alphanumeric format regexes before database lookups, and ownership boundaries are enforced in middleware.

---

## 4. Strict CORS Configuration

- **Explicit Origin Whitelist**: Controlled via `CORS_ALLOWED_ORIGINS` in `.env`.
- **No Wildcards**: Never uses `*` when credentials or authentication headers are present.
- **Allowed Methods**: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- **Allowed Headers**: `Content-Type, Authorization, X-Requested-With, Accept, Origin`.
- **Exposed Headers**: Rate limiting headers and `Retry-After`.
- **Preflight Handling**: Valid `OPTIONS` requests receive `204 No Content` with `Access-Control-Max-Age: 86400`. Disallowed origins receive `403 Forbidden`.

---

## 5. Zod Validation for Forms

- **Universal Schemas**: Located in `src/shared/schemas.ts` and shared across frontend and backend.
  - `CustomerFormSchema`: Validates full name, email format, Hungarian phone numbers (`+36...` or `06...`), location, multi-select job types from approved dictionary, urgency levels, and optional description.
  - `FreelancerFormSchema`: Validates contractor details, multi-select trade specializations, experience levels, area preferences, and license document metadata and size constraints.
  - `LoginSchema`: Validates username and password bounds.
  - `UpdateStatusSchema`: Validates submission lifecycle transitions (`pending` -> `approved` | `rejected`).
- **Client-Side UX**: Instant inline validation indicators and user-friendly Hungarian error prompts.
- **Server-Side Enforcement**: All untrusted inputs are validated via `validateBody(schema)`, returning structured `400 Bad Request` responses on error without leaking stack traces.

---

## 6. Testing

### Run Backend Tests (Unit & Integration)
```bash
npm run test
```

### Run End-to-End Smoke Tests
```bash
npm run test:e2e
```

### Run All Tests
```bash
npm run test:all
```

### Typecheck & Build
```bash
npm run typecheck
npm run build
```

---

## 7. Starting the Server

```bash
# Start production server
npm start

# Start development server with auto-reload
npm run dev
```

