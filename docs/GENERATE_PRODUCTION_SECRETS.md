# Generate Production Secrets for VPS Deployment

This guide shows how to safely generate all required production secrets for the FieldOps SaaS deployment to VPS (76.13.187.232).

## Quick Setup (Copy & Paste)

Run these commands to generate all secrets at once:

```bash
# Generate SECRET_KEY (Django CSRF/session/cookie signing)
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))"

# Generate FIELD_ENCRYPTION_KEY (Fernet encryption for ERP credentials)
python -c "from cryptography.fernet import Fernet; print('FIELD_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"

# Generate CONNECTOR_API_KEY (on-prem agent authentication)
python -c "import secrets; print('CONNECTOR_API_KEY=' + secrets.token_urlsafe(32))"

# Generate POSTGRES_PASSWORD (database access)
python -c "import secrets, string; pwd = secrets.choice(string.ascii_uppercase) + ''.join(secrets.choice(string.ascii_letters + string.digits + '!@#$%') for _ in range(23)); print('POSTGRES_PASSWORD=' + pwd)"
```

## Detailed Secret Explanation

### 1. SECRET_KEY (Django)
**Purpose**: Signs cookies, sessions, CSRF tokens, password reset links  
**Length**: 50+ random URL-safe characters  
**Rotation**: Never change once set (breaks existing sessions)  
**Backup**: CRITICAL — losing this breaks authentication

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
# Example output: SECRET_KEY=xK7-JnQ2...dFr4zB9
```

### 2. FIELD_ENCRYPTION_KEY (Fernet)
**Purpose**: Encrypts ERP connector credentials (Tally API keys) at rest  
**Format**: Base64-encoded 256-bit Fernet key  
**Rotation**: Very difficult (re-encrypt all stored credentials)  
**Backup**: CRITICAL — losing this makes all encrypted data unrecoverable

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Example output: FIELD_ENCRYPTION_KEY=WQ3dKp1...8-fB7L0=
```

### 3. CONNECTOR_API_KEY (On-Prem Agent)
**Purpose**: Authenticates requests from on-prem Tally connector  
**Format**: 32+ random URL-safe characters  
**Rotation**: Can be rotated (update on-prem agent config)  
**Backup**: Important — needed to reconfigure on-prem agents

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Example output: CONNECTOR_API_KEY=5Xb-2LmK...jP9_dQ8
```

### 4. POSTGRES_PASSWORD (Database)
**Purpose**: Access PostgreSQL database (vansales DB)  
**Format**: 20+ chars with uppercase, lowercase, numbers, symbols  
**Rotation**: Possible but requires database admin work  
**Backup**: Important — needed for manual DB access, backups

```bash
# Option A: Strong random password
python -c "import secrets, string; pwd = secrets.choice(string.ascii_uppercase) + ''.join(secrets.choice(string.ascii_letters + string.digits + '!@#$%') for _ in range(23)); print(pwd)"
# Example output: Tr0p1cal!QuEsT_P@ss2024

# Option B: Memorizable (less secure, not recommended)
# Example: MyFieldOps2024!@#$ (still 20+ chars with mixed case/symbols)
```

## Step-by-Step Deployment Setup

### 1. Generate All Secrets
```bash
# Create a temporary file to collect secrets
cat > /tmp/secrets.txt << 'EOF'
# Run each command and paste output below:

# 1. SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(50))"

# 2. FIELD_ENCRYPTION_KEY  
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# 3. CONNECTOR_API_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 4. POSTGRES_PASSWORD (20+ chars, mixed case/numbers/symbols)
python -c "import secrets, string; pwd = secrets.choice(string.ascii_uppercase) + ''.join(secrets.choice(string.ascii_letters + string.digits + '!@#$%') for _ in range(23)); print(pwd)"
EOF
```

### 2. Copy Template and Fill In Secrets
```bash
# From the repo root:
cp infra/.env.production.template infra/.env

# Edit the file and replace "change-me-*" values with your generated secrets
nano infra/.env
```

### 3. Verify Configuration
```bash
# Check that all critical values are set
grep -E "SECRET_KEY=|FIELD_ENCRYPTION_KEY=|CONNECTOR_API_KEY=|POSTGRES_PASSWORD=" infra/.env

# Should show 4 lines with actual values (not "change-me-*")
```

### 4. Secure File Permissions
```bash
# Ensure .env is only readable by owner (u=rw, go=)
chmod 600 infra/.env

# Verify
ls -la infra/.env
# Should show: -rw------- (600)
```

### 5. Deploy to VPS
```bash
cd infra
bash deploy.sh
```

## Verification Checklist

After deployment, verify production is ready:

```bash
# 1. SSH into VPS
ssh root@76.13.187.232

# 2. Check .env permissions (should be 600)
ls -la /path/to/infra/.env
chmod 600 /path/to/infra/.env  # If needed

# 3. Verify containers are running
docker compose -f infra/docker-compose.prod.yml ps

# 4. Test backend health
curl https://api.fieldopspro.in/health/

# 5. Check backend logs for SECRET_KEY validation
docker compose -f infra/docker-compose.prod.yml logs backend | grep -i secret

# 6. Verify database is initialized
docker compose -f infra/docker-compose.prod.yml exec postgres psql -U vansales -d vansales -c "SELECT 1;"

# 7. Create admin user (first time only)
docker compose -f infra/docker-compose.prod.yml exec backend python manage.py createsuperuser

# 8. Test frontend loads
curl https://fieldopspro.in/ -L
```

## Disaster Recovery

### If You Lose SECRET_KEY
**Impact**: All sessions become invalid, password reset links break  
**Recovery**: 
1. Generate new SECRET_KEY
2. Update .env
3. Restart backend container
4. All existing users must log in again

### If You Lose FIELD_ENCRYPTION_KEY
**Impact**: All encrypted ERP credentials become unrecoverable  
**Recovery**:
1. **Not recoverable** — you must:
   - Notify all users that ERP credentials must be re-entered
   - Re-setup all Tally connector integrations
2. Generate new FIELD_ENCRYPTION_KEY
3. Update .env and restart

### If POSTGRES_PASSWORD is Exposed
**Recovery**:
1. Generate new POSTGRES_PASSWORD
2. Update .env
3. Connect to VPS: `ssh root@76.13.187.232`
4. Update database user:
   ```bash
   docker compose -f infra/docker-compose.prod.yml exec postgres psql -U postgres -c "ALTER USER vansales WITH PASSWORD 'new-password';"
   ```
5. Restart containers

## Security Best Practices

1. **Never commit .env to git** — it's .gitignored, always verify
2. **Backup secrets securely** — store in password manager (1Password, LastPass, Vault)
3. **Use strong passwords** — 20+ chars, mixed case, numbers, symbols
4. **Rotate periodically** — generate new keys annually
5. **Audit access** — log who accesses VPS and when
6. **Use Vault (optional)** — for true secret management with rotation
7. **Monitor for exposure** — watch git logs, CI logs, deployment logs for leaks

## Troubleshooting

### "POSTGRES_PASSWORD too weak"
→ Use 20+ characters with mixed case, numbers, and symbols

### "SECRET_KEY not set"
→ Run: `python -c "import secrets; print(secrets.token_urlsafe(50))"`

### "FIELD_ENCRYPTION_KEY invalid format"
→ Must be Fernet format (starts with "gAAAAAB...")
→ Run: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

### "Cannot decrypt stored credentials"
→ FIELD_ENCRYPTION_KEY mismatch — never change once set on encrypted data

## Support

For deployment help, see:
- docs/DEPLOYMENT.md — Full deployment guide
- docs/CI_CD_QUICK_START.md — CI/CD automation
- infra/deploy.sh — Deployment script with inline documentation
