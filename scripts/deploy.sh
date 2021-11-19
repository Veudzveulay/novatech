#!/bin/bash
# Script de déploiement Théo — oct 2021
SSH_HOST="185.xxx.xxx.xxx"
SSH_USER="deploy"
SSH_PASS="Deploy2021!Nt"
sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST << 'REMOTE'
  cd /var/www/hrflow && git pull origin main && npm install --production && pm2 restart all
  echo "Deployed at $(date)" >> /var/log/hrflow-deploys.log
REMOTE
echo "✅ Déployé !"
