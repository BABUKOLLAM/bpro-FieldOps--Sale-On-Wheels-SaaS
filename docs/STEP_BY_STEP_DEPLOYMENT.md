# 🚀 STEP-BY-STEP VPS DEPLOYMENT GUIDE

## Phase 1: Generate Production Secrets (Local Machine)
**Time: 5 minutes | Platform: macOS/Linux terminal**

### Step 1.1: Generate SECRET_KEY
This is used by Django for signing cookies, sessions, and CSRF tokens.

**Run this command:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

**Expected output (example):**
```
dKp9-xJmL2QvR8nF5HgB3_cZaW4eYsTuPo1jKd6vI7wMq2rN9Xb
```

**ACTION**: Copy the output and save it somewhere safe (notepad, notes app, etc.)
Label it: `SECRET_KEY`

---

### Step 1.2: Generate FIELD_ENCRYPTION_KEY
This encrypts ERP connector credentials (Tally API keys) at rest in database.

**Run this command:**
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Expected output (example):**
```
gAAAAABm-xK1pZ8Q9vR4mLqJdF2hG6sTuXyWaB3cN5eK7oP9l2mQ3rS6tU8vV
```

**ACTION**: Copy the output and save it
Label it: `FIELD_ENCRYPTION_KEY`

---

### Step 1.3: Generate CONNECTOR_API_KEY
This authenticates requests from on-premises Tally connector.

**Run this command:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Expected output (example):**
```
5Xb-2LmKqP9_dQ8jR1fL6nT3vW2yZ4xA
```

**ACTION**: Copy the output and save it
Label it: `CONNECTOR_API_KEY`

---

### Step 1.4: Generate POSTGRES_PASSWORD
This is the database admin password. Must be 20+ characters with uppercase, lowercase, numbers, and symbols.

**Run this command:**
```bash
python3 -c "import secrets, string; pwd = secrets.choice(string.ascii_uppercase) + ''.join(secrets.choice(string.ascii_letters + string.digits + '!@#$%^&*') for _ in range(25)); print(pwd)"
```

**Expected output (example):**
```
Tr0p1c@l!QuEsT_P@ss2024!xYz
```

**ACTION**: Copy the output and save it
Label it: `POSTGRES_PASSWORD`

---

### ✅ Step 1 Complete
You should now have 4 secrets saved:
- [ ] SECRET_KEY
- [ ] FIELD_ENCRYPTION_KEY
- [ ] CONNECTOR_API_KEY
- [ ] POSTGRES_PASSWORD

**⚠️ SECURITY WARNING**: Store these securely!
- Save to password manager (1Password, LastPass, etc.)
- Never commit to git
- Never share in Slack/email
- Create backup copy

---

## Phase 2: Create Production .env File
**Time: 10 minutes | Platform: Local machine**

### Step 2.1: Navigate to project directory
```bash
cd /path/to/bpro-FieldOps  # Your repo directory
```

### Step 2.2: Copy template to .env
```bash
cp infra/.env.production.template infra/.env
```

**Verify file created:**
```bash
ls -la infra/.env
```

**Should show:** `-rw-r--r-- ... infra/.env` ✅

---

### Step 2.3: Edit .env file with production values

**Open the file:**
```bash
nano infra/.env
```

**Find and replace these values:**

1. **Find line:** `SECRET_KEY=change-me-generate-with-python-secrets-token-urlsafe-50`
   **Replace with:** Your SECRET_KEY from Step 1.1

2. **Find line:** `FIELD_ENCRYPTION_KEY=change-me-fernet-key-generated-with-cryptography`
   **Replace with:** Your FIELD_ENCRYPTION_KEY from Step 1.2

3. **Find line:** `CONNECTOR_API_KEY=change-me-connector-api-key`
   **Replace with:** Your CONNECTOR_API_KEY from Step 1.3

4. **Find line:** `POSTGRES_PASSWORD=change-me-strong-password-20plus-chars`
   **Replace with:** Your POSTGRES_PASSWORD from Step 1.4

5. **Find line:** `ALLOWED_HOSTS=api.fieldopspro.in,backend`
   **Keep as-is** (unless your domain is different)
   Example: `ALLOWED_HOSTS=api.yourdomain.com,backend`

6. **Find line:** `CORS_ALLOWED_ORIGINS=https://app.fieldopspro.in,https://fieldopspro.in,https://www.fieldopspro.in`
   **Update if needed** (use your actual frontend domains)

7. **Find line:** `FRONTEND_BASE_URL=https://fieldopspro.in`
   **Update if needed** (your primary domain)

8. **Find line:** `NEXT_PUBLIC_API_BASE_URL=https://api.fieldopspro.in`
   **Update if needed** (your API domain)

9. **Find line:** `COMPANY_NAME=Your Company Name Pvt Ltd`
   **Update** with your actual company name

**To save in nano editor:**
- Press: `Ctrl + X`
- Type: `Y` (yes)
- Press: `Enter` (confirm filename)

---

### Step 2.4: Set secure file permissions

```bash
chmod 600 infra/.env
```

**Verify permissions:**
```bash
ls -la infra/.env
```

**Should show:** `-rw------- ... infra/.env` ✅ (only owner can read/write)

---

### Step 2.5: Verify .env file is complete

Check that all critical secrets are filled in (not "change-me-*"):

```bash
grep -E "SECRET_KEY=|FIELD_ENCRYPTION_KEY=|CONNECTOR_API_KEY=|POSTGRES_PASSWORD=" infra/.env
```

**Should show 4 lines with actual values, NOT "change-me-*":**
```
SECRET_KEY=dKp9-xJmL2QvR8nF5HgB3_cZaW4eYsTuPo1jKd6vI7wMq2rN9Xb
FIELD_ENCRYPTION_KEY=gAAAAABm-xK1pZ8Q9vR4mLqJdF2hG6sTuXyWaB3cN5eK7oP9l2mQ3rS6tU8vV
CONNECTOR_API_KEY=5Xb-2LmKqP9_dQ8jR1fL6nT3vW2yZ4xA
POSTGRES_PASSWORD=Tr0p1c@l!QuEsT_P@ss2024!xYz
```

✅ If all 4 secrets show real values → Ready for next step!
❌ If any show "change-me-*" → Go back and edit them

---

### ✅ Step 2 Complete
You now have:
- [ ] infra/.env created
- [ ] All secrets filled in
- [ ] File permissions set to 600
- [ ] Backup of secrets in password manager

---

## Phase 3: Connect to VPS & Prepare for Deployment
**Time: 5 minutes | Platform: VPS 76.13.187.232**

### Step 3.1: SSH into VPS

```bash
ssh root@76.13.187.232
```

**You should see:**
```
root@76.13.187.232's password:
```

**Enter the VPS root password** (provided by hosting provider)

**After login, you should see:**
```
root@vps:~#
```

✅ You're now connected to VPS!

---

### Step 3.2: Verify Docker is installed

```bash
docker --version
docker compose version
```

**Expected output:**
```
Docker version 20.10.x or higher
Docker Compose version 2.x or higher
```

❌ If Docker not installed, see troubleshooting section below

---

### Step 3.3: Navigate to application directory

Assuming application is at `/root/bpro-fieldops`:

```bash
cd /root/bpro-fieldops
ls -la
```

**Should show:**
- `infra/` directory
- `backend/` directory
- `admin-web/` directory
- `.github/` directory
- `README.md`

✅ You're in the right place!

---

### Step 3.4: Verify .env file is present

```bash
ls -la infra/.env
chmod 600 infra/.env
```

**Should show:**
```
-rw------- root root ... infra/.env
```

---

### ✅ Step 3 Complete
You have:
- [ ] SSH access to VPS confirmed
- [ ] Docker verified
- [ ] Application files present
- [ ] .env file in correct location with 600 permissions

---

## Phase 4: Deploy to VPS
**Time: 5-10 minutes | Platform: VPS terminal**

### Step 4.1: Navigate to infra directory

```bash
cd /root/bpro-fieldops/infra
pwd
```

**Should show:**
```
/root/bpro-fieldops/infra
```

---

### Step 4.2: Run deployment script

```bash
bash deploy.sh
```

**You should see output similar to:**
```
==> Preflight: checking /root/bpro-fieldops/infra/.env secrets
==> ✓ SECRET_KEY is set
==> ✓ FIELD_ENCRYPTION_KEY is set
==> ✓ CONNECTOR_API_KEY is set
==> ✓ POSTGRES_PASSWORD is set
...
==> Building Docker images (or pulling if IMAGE_TAG set)
...
==> Starting containers with docker compose
[+] Running 5/5
 ✓ Container vansales-redis-1  Started
 ✓ Container vansales-postgres-1  Started
 ✓ Container vansales-backend-1  Started
 ✓ Container vansales-admin-web-1  Started
 ✓ Container vansales-nginx-1  Started
...
==> ✓ Health check passed: backend is running
==> ✓ Deployment successful!
```

**This process will take 2-5 minutes depending on:**
- Image download time
- Build time
- Database initialization

---

### Step 4.3: Wait for containers to stabilize

After deployment script completes, wait 30 seconds:

```bash
sleep 30
docker compose ps
```

**Should show all containers with status "Up":**
```
NAME                    STATUS
vansales-redis-1       Up 45 seconds
vansales-postgres-1    Up 1 minute
vansales-backend-1     Up 30 seconds
vansales-admin-web-1   Up 30 seconds
vansales-nginx-1       Up 25 seconds
```

✅ All containers running!

---

### ✅ Step 4 Complete
You have:
- [ ] Deployment script executed
- [ ] All containers started
- [ ] Health check passed
- [ ] Services stabilized

---

## Phase 5: Verify Deployment
**Time: 5 minutes | Platform: VPS terminal + Browser**

### Step 5.1: Check backend health endpoint

```bash
curl -s https://api.fieldopspro.in/health/ | python3 -m json.tool
```

**Expected output (example):**
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2024-08-25T08:56:12Z"
}
```

✅ Backend is healthy!

---

### Step 5.2: Check application logs

```bash
docker compose logs -f backend --tail 50
```

**Look for:**
- `Migrating database` ✅
- `Starting Django server` ✅
- No ERROR messages ✅

**To exit logs:**
- Press: `Ctrl + C`

---

### Step 5.3: Create first admin user

```bash
docker compose exec backend python manage.py createsuperuser
```

**You'll be prompted:**
```
Username: admin
Email: admin@fieldopspro.in
Password:
Password (again):
Superuser created successfully.
```

**Use:**
- Username: `admin`
- Email: `admin@fieldopspro.in`
- Password: Create a strong password (20+ chars)

---

### Step 5.4: Test admin login in browser

1. **Open browser** and go to:
   ```
   https://fieldopspro.in
   ```

2. **You should see:** Admin login page (or redirected to login)

3. **Click:** "Admin Login" or "Sign In"

4. **Enter credentials:**
   - Username: `admin`
   - Password: (what you created in Step 5.3)

5. **Click:** "Sign In"

**Expected result:** ✅ You're logged in to admin dashboard!

---

### Step 5.5: Verify all services are responding

**Backend API:**
```bash
curl -s https://api.fieldopspro.in/api/v1/ -H "Authorization: Bearer YOUR_TOKEN"
```

**Frontend:**
```bash
curl -s https://app.fieldopspro.in/ | head -20
```

**Should show HTML content** ✅

---

### Step 5.6: Check HTTPS/SSL certificate

```bash
curl -vI https://api.fieldopspro.in/ 2>&1 | grep -i "certificate\|issuer"
```

**Should show:**
```
SSL certificate problem: self signed certificate
(if using self-signed - this is OK for testing)

OR

subject: CN=fieldopspro.in
issuer: C=US, O=Let's Encrypt
(if using Let's Encrypt - this is ideal for production)
```

---

### ✅ Step 5 Complete
You have verified:
- [ ] Backend health endpoint responds
- [ ] Application logs show no errors
- [ ] Admin user created successfully
- [ ] Can login to admin dashboard
- [ ] All services accessible
- [ ] HTTPS/SSL working

---

## 🎉 Deployment Complete!

Your bpro FieldOps SaaS platform is now live on VPS 76.13.187.232!

### What's Running:
- ✅ Backend API: https://api.fieldopspro.in
- ✅ Admin Dashboard: https://fieldopspro.in
- ✅ Frontend (App): https://app.fieldopspro.in
- ✅ Database: PostgreSQL (postgres:6379)
- ✅ Cache: Redis (redis:6379)
- ✅ Reverse Proxy: Nginx

### Next Steps:

1. **Create additional users** (customers, field agents, admins)
   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

2. **Set up email** (optional - for password resets)
   Update `.env` with EMAIL_HOST, EMAIL_PORT, etc.

3. **Configure connectors** (Tally integration)
   Provide CONNECTOR_API_KEY to on-prem connector setup

4. **Enable monitoring** (optional - for production)
   Set up Sentry, Prometheus, or similar

5. **Automated backups** (recommended)
   Set up database backup schedule

---

## 🆘 Troubleshooting

### Issue: "ssh: command not found"
**Solution:** Install SSH client on your machine:
- macOS: `brew install openssh` (usually pre-installed)
- Windows: Use PuTTY or Windows Terminal

---

### Issue: "Connection refused" (SSH)
**Solution:** Check VPS IP and password:
```bash
ssh -v root@76.13.187.232
# Verify IP is correct: 76.13.187.232
# Verify password is correct
# Check firewall allows SSH port 22
```

---

### Issue: "Docker: command not found" on VPS
**Solution:** Install Docker:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
bash get-docker.sh
```

---

### Issue: "Permission denied" for .env
**Solution:** Fix file permissions:
```bash
chmod 600 infra/.env
ls -la infra/.env  # Should show: -rw------- 
```

---

### Issue: "Deployment failed: Secrets not set"
**Solution:** Verify .env has all values:
```bash
grep -E "SECRET_KEY=|FIELD_ENCRYPTION_KEY=|CONNECTOR_API_KEY=|POSTGRES_PASSWORD=" infra/.env
# All 4 lines should show actual values (not "change-me-*")
```

---

### Issue: "Health check failed"
**Solution:** Check container logs:
```bash
docker compose logs backend --tail 100
# Look for error messages
# Common issues: SECRET_KEY not set, database connection, port conflicts
```

---

### Issue: "Cannot access https://api.fieldopspro.in"
**Solution:** Check DNS and firewall:
```bash
# On VPS, verify nginx is running
docker compose ps
# Should show vansales-nginx-1 with status "Up"

# Check Nginx logs
docker compose logs nginx --tail 50

# Verify DNS points to VPS IP
nslookup api.fieldopspro.in
# Should show: 76.13.187.232 (or your VPS IP)
```

---

### Issue: "SSL/TLS certificate error"
**Solution:** Set up proper certificate:
- For testing: Self-signed cert is OK
- For production: Use Let's Encrypt via Certbot
  ```bash
  apt-get update && apt-get install -y certbot python3-certbot-nginx
  certbot certonly --standalone -d fieldopspro.in -d api.fieldopspro.in
  # Update Nginx to use certificates
  ```

---

## 📞 Additional Help

For detailed information, see:
- `docs/DEPLOYMENT.md` — Full deployment guide
- `docs/PRODUCTION_AUDIT.md` — Security audit report
- `docs/CI_CD_QUICK_START.md` — CI/CD automation
- `infra/deploy.sh` — Deployment script with inline comments

