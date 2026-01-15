# Automatic Deployment Setup Guide

This guide will help you set up automatic deployment from GitHub to your VPS (like Vercel).

## 🚀 How It Works

Every time you push to the `master` branch, GitHub Actions will:
1. Connect to your VPS via SSH
2. Pull the latest code
3. Install dependencies
4. Build the frontend
5. Update the database schema
6. Restart backend and frontend services

## 📋 Setup Steps

### Step 1: Push the Workflow File

The workflow file is already committed locally. Push it to GitHub:

```bash
git push origin master
```

If you get an error about workflow scope, you'll need to:
1. Go to: https://github.com/settings/tokens
2. Generate a new token with `workflow` scope
3. Update your git credentials

### Step 2: Add GitHub Secrets

Go to your repository settings:
https://github.com/zakaria1symloop/djaber/settings/secrets/actions

Click **"New repository secret"** and add these three secrets:

#### Secret 1: VPS_HOST
- **Name:** `VPS_HOST`
- **Value:** `72.61.102.55`

#### Secret 2: VPS_USERNAME
- **Name:** `VPS_USERNAME`
- **Value:** `root`

#### Secret 3: VPS_SSH_KEY
- **Name:** `VPS_SSH_KEY`
- **Value:** (Copy the entire private key below)

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBGoDCN255oRJaIGGygWU3sKhyOOntNmr4DvTy+2/azVwAAAJj68QY0+vEG
NAAAAAtzc2gtZWQyNTUxOQAAACBGoDCN255oRJaIGGygWU3sKhyOOntNmr4DvTy+2/azVw
AAAEDto75wRKEb6pMFbvjo3owbxHoiPbxkd8tUlYR4aUF7wUagMI3bnmhElogYbKBZTewq
HI46e02avgO9PL7b9rNXAAAAFWdpdGh1Yi1hY3Rpb25zLWRlcGxveQ==
-----END OPENSSH PRIVATE KEY-----
```

**⚠️ IMPORTANT:** Copy the ENTIRE key including the `-----BEGIN` and `-----END` lines.

### Step 3: Test the Deployment

Once you've added all three secrets, test the deployment:

1. Make a small change to your code (e.g., update README.md)
2. Commit and push:
   ```bash
   git add .
   git commit -m "Test auto-deployment"
   git push origin master
   ```
3. Go to: https://github.com/zakaria1symloop/djaber/actions
4. Watch the deployment progress in real-time!

## 🎯 Expected Result

After a successful deployment, you'll see:
- ✅ Green checkmark in GitHub Actions
- 🌐 Your app updated at: http://72.61.102.55:3002
- 🔗 API updated at: http://72.61.102.55:5000

## 📊 Monitoring Deployments

- **View all deployments:** https://github.com/zakaria1symloop/djaber/actions
- **Re-run a deployment:** Click on any workflow run and click "Re-run jobs"
- **Manual deployment:** Go to Actions tab → Deploy to VPS → Run workflow

## 🛠️ Troubleshooting

### Deployment Fails
1. Check the logs in GitHub Actions
2. SSH into your VPS and check PM2 status: `pm2 list`
3. View backend logs: `pm2 logs djaber-backend`
4. View frontend logs: `pm2 logs djaber-frontend`

### Need to Update Environment Variables
SSH into your VPS and edit:
```bash
nano /var/www/djaber/backend/.env
```
Then restart services:
```bash
pm2 restart djaber-backend
```

## 🔒 Security Notes

- The SSH key is only stored in GitHub Secrets (encrypted)
- Never commit the private key (`.github-deploy-key`) to GitHub
- The `.gitignore` is already configured to exclude it

## 📝 Files Created

- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `/var/www/djaber/deploy.sh` - Deployment script on VPS
- `.github-deploy-key` - SSH private key (local only, DO NOT COMMIT)
- `.github-deploy-key.pub` - SSH public key (added to VPS)

---

**You now have automatic deployments just like Vercel! 🎉**
