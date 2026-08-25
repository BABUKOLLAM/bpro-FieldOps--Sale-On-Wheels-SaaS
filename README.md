# bpro FieldOps — Sales on Wheels

[![CI/CD Pipeline](https://github.com/BABUKOLLAM/bpro-FieldOps--Sale-On-Wheels-SaaS/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/BABUKOLLAM/bpro-FieldOps--Sale-On-Wheels-SaaS/actions/workflows/backend-ci.yml)

Phase 1 MVP of a field/van sales platform: offline-first mobile billing app,
web admin/back-office panel, and a Tally Prime sync layer. Built as a
per-client-deployment template — see [`docs/PROVISIONING.md`](docs/PROVISIONING.md)
for how a new client instance is stood up, and [`docs/architecture.md`](docs/architecture.md)
for the system design.

## Components

| Folder | Stack | Purpose |
|---|---|---|
| `backend/` | Django + DRF + PostgreSQL + Celery | API, business rules, Tally sync orchestration |
| `admin-web/` | Next.js (TypeScript) | Back-office dashboard, master data, approvals |
| `mobile/` | React Native (TypeScript) + WatermelonDB | Offline-first field sales app |
| `infra/` | Docker Compose | Local dev stack (Postgres, Redis, backend, Celery, admin-web) |

## Quick start (local dev)

```bash
cp .env.example .env   # edit values for your machine
cd infra
docker compose up --build
```

Then, in a separate shell, seed demo data:

```bash
docker compose exec backend python manage.py seed_demo_data
```

- Backend API: http://localhost:8000/api/
- API schema/docs: http://localhost:8000/api/schema/swagger-ui/
- Admin web: http://localhost:3000

Demo login (after seeding): `tech@bpropms.com` / `Bpro#1234`

## Mobile app

```bash
cd mobile
npm install
npm run ios     # or: npm run android
```

Set `API_BASE_URL` in `mobile/.env` to your backend's reachable address
(use your machine's LAN IP, not `localhost`, when testing on a physical device).

## Production Deployment & CI/CD

**Full production-grade deployment** with automated testing, security scanning, image signing, and optional auto-deploy:

- [**CI/CD Quick Start**](docs/CI_CD_QUICK_START.md) — 5-minute setup guide for GitHub Actions automation
- [**Deployment Guide**](docs/DEPLOYMENT.md) — Complete deployment runbook including Vault integration, secrets management, and VPS setup
- [**Verify Image Signatures**](scripts/verify-image-signature.sh) — Script to verify Docker images signed by CI (keyless cosign)

### Key Features

- ✅ **Automated testing** — 296 backend tests, Django checks, dependency scanning
- ✅ **Security scanning** — Trivy CVE scans, pip-audit, Bandit code analysis
- ✅ **SBOM generation** — CycloneDX SBOMs attached to releases for compliance
- ✅ **Image signing** — Sigstore cosign keyless OIDC signing (no secrets needed)
- ✅ **Vault integration** — AppRole support, production fail-fast checks
- ✅ **Immutable deployments** — Images tagged by commit SHA for reproducibility
- ✅ **Manual approval gates** — Protected production environment requiring reviewer sign-off
- ✅ **Release automation** — GitHub Releases with SBOMs and verification instructions

### Quick Deploy

```bash
# Create a release (tags images, signs, generates SBOMs, creates release)
git tag v1.0.0
git push origin v1.0.0

# On your VPS, deploy with
export IMAGE_REGISTRY=ghcr.io/OWNER/REPO/
export IMAGE_TAG=v1.0.0
cd infra
./deploy.sh
```

## Status

Phase 1 MVP vertical slice — see [`docs/architecture.md`](docs/architecture.md) for
what's implemented vs. the fuller BRD roadmap (Phase 2/3 features are intentionally
out of scope for this build).
