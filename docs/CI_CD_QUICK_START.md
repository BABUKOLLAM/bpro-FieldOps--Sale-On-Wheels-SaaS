# CI/CD Quick Start Guide

A fast reference for setting up and using the automated build, test, security scan, and deployment pipeline.

## TL;DR Setup (5 minutes)

1. **Enable package write permissions for GitHub Actions:**
   - Go to repo **Settings → Actions → General → Workflow permissions**
   - Enable **Read and write permissions**
   - Click **Save**

2. **That's it!** CI now runs automatically on every push to `main` and every Git tag.

## Automatic CI On Every Push

When you push to `main` or create a Git tag, GitHub Actions automatically:

```
✅ Run backend tests (296 test cases)
✅ Run Vault acceptance tests
✅ Scan Python/Node dependencies for vulnerabilities
✅ Build Docker images
✅ Scan images for CVEs (Trivy)
✅ Generate SBOMs (supply chain transparency)
✅ Sign images with cosign (keyless OIDC)
✅ Push images to GitHub Container Registry (ghcr.io)
✅ Create GitHub Release (on Git tags)
✅ Attach SBOMs to release (on Git tags)
```

View CI status: Go to **Actions** tab in the repo.

## Optional: Enable Auto-Deploy to VPS

To automatically deploy to your VPS after tests pass (with manual approval):

1. **Add secrets to repo** (Settings → Secrets and variables → Actions):
   ```
   VPS_SSH_PRIVATE_KEY   ← Your VPS SSH private key (full PEM)
   VPS_HOST              ← deployment VPS IP or hostname
   VPS_SSH_USER          ← SSH username (usually ubuntu or root)
   VPS_REPO_PATH         ← Repo path on VPS (e.g., /home/deploy/bpro-fieldops)
   VPS_SSH_PORT          ← Optional, defaults to 22
   ```

2. **Create protected environment** (Settings → Environments):
   - Click **New environment** → Name it `production`
   - Check **Require reviewers** and add your team members
   - Save

3. **Deploy**: After tests pass, the workflow waits for manual approval. A reviewer approves, and deploy.sh runs automatically on the VPS.

## Create a Release & Push Images

To tag and release a version:

```bash
# Create a Git tag (semver recommended)
git tag v1.0.0
git push origin v1.0.0
```

CI will:
- Build images with both commit-SHA and `v1.0.0` tags
- Scan, sign, and push images
- Create a GitHub Release with description
- Attach SBOMs as downloadable files

View release: Go to **Releases** tab in the repo.

## Verify Image Signatures Locally

After CI pushes images, verify them with cosign (keyless):

```bash
# Install cosign (macOS)
brew install cosign

# Verify a specific image
cosign verify --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/OWNER/REPO/vansales-backend:v1.0.0

# Output: signature verified ✓
```

Replace `OWNER/REPO` with your GitHub org/repo.

## Pull & Deploy Images Locally

To run a specific release locally:

```bash
export IMAGE_REGISTRY=ghcr.io/OWNER/REPO/
export IMAGE_TAG=v1.0.0

cd infra
docker login ghcr.io  # Use GitHub token as password
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### "Workflow permission denied pushing images"
- **Fix**: Settings → Actions → General → Workflow permissions → Enable **Read and write permissions**

### "Trivy found HIGH severity vulnerabilities"
- **Action**: Workflow fails, images not pushed
- **Fix**: Update vulnerable packages in `backend/requirements/base.txt` or admin-web dependencies, then push again
- **View findings**: Go to Actions → Workflow run → Trivy scan step logs

### "VPS deploy failed (SSH error)"
- **Fix**: 
  - Verify SSH secrets are correct: `ssh -i <key> <user>@<host>`
  - Ensure `VPS_REPO_PATH` exists on VPS and contains a valid repo clone
  - Check deploy.sh is executable: `chmod +x infra/deploy.sh`

### "Images not signed (cosign error)"
- **Note**: Cosign keyless signing (OIDC) is automatic; no keys to configure
- **If it fails**: Check GitHub OIDC issuer is reachable (rare)
- **Fallback**: Manually sign with: `cosign sign --yes ghcr.io/OWNER/REPO/vansales-backend:sha`

## Common Commands

### Monitor CI status
```bash
# View Actions in the browser
open https://github.com/OWNER/REPO/actions

# Or check latest run status from CLI
gh run list --repo OWNER/REPO --limit 5
```

### Re-run a failed workflow
```bash
gh run rerun <run-id> --repo OWNER/REPO
```

### View SBOMs (on releases)
```bash
# Download SBOM from a release
gh release download v1.0.0 --pattern "*.json" --repo OWNER/REPO

# View SBOM content (CycloneDX format)
cat sbom-backend.json | jq
```

### Manual image push (without CI)
If you need to push images manually:

```bash
cd backend
docker build -t ghcr.io/OWNER/REPO/vansales-backend:manual .
docker login ghcr.io
docker push ghcr.io/OWNER/REPO/vansales-backend:manual

# Sign manually (requires OIDC token or a local key)
export COSIGN_EXPERIMENTAL=1
cosign sign --yes ghcr.io/OWNER/REPO/vansales-backend:manual
```

## Security Best Practices

1. **Rotate SSH keys regularly** (VPS_SSH_PRIVATE_KEY secret)
2. **Use release tags for production** (avoid rolling on `main` in prod)
3. **Review cosign signatures** before deploying unknown images
4. **Audit SBOMs** for known-bad dependencies before release
5. **Monitor Trivy findings** and update dependencies proactively

## For More Details

- Full deployment guide: [docs/DEPLOYMENT.md](DEPLOYMENT.md)
- Repository secrets setup: [docs/DEPLOYMENT.md#github-actions-cicd-configuration](DEPLOYMENT.md#github-actions-cicd-configuration)
- Vault integration: [docs/DEPLOYMENT.md#vault-integration](DEPLOYMENT.md#vault-integration)
- Image building & signing: [.github/workflows/backend-ci.yml](../.github/workflows/backend-ci.yml)
