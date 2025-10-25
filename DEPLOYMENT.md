# Deployment Guide

This guide covers deploying the custom booking system to production.

## Deployment Options

### Option 1: Deploy to Vercel (Recommended - Free & Easy)

Vercel is perfect for Node.js applications and offers free hosting.

#### Steps:

1. **Install Vercel CLI:**
```bash
npm install -g vercel
```

2. **Login to Vercel:**
```bash
vercel login
```

3. **Create `vercel.json` in project root:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

4. **Deploy:**
```bash
cd worry-free-booking
vercel
```

5. **Set Environment Variables:**
```bash
vercel env add EMAIL_SERVICE
vercel env add EMAIL_USER
vercel env add EMAIL_PASSWORD
vercel env add COMPANY_EMAIL
# Add other env variables as needed
```

6. **Deploy to Production:**
```bash
vercel --prod
```

Vercel will provide a URL like: `https://worry-free-booking.vercel.app`

Update your chatbot's `apiUrl` to this URL.

### Option 2: Deploy to Heroku

1. **Create Heroku Account:** https://heroku.com

2. **Install Heroku CLI:**
```bash
npm install -g heroku
```

3. **Login:**
```bash
heroku login
```

4. **Create Heroku App:**
```bash
cd worry-free-booking
heroku create worry-free-booking
```

5. **Set Environment Variables:**
```bash
heroku config:set EMAIL_SERVICE=gmail
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASSWORD=your-password
heroku config:set COMPANY_EMAIL=service@worryfreemovers.com
# Add other variables
```

6. **Add Procfile:**
Create a file named `Procfile` (no extension) with:
```
web: node server.js
```

7. **Deploy:**
```bash
git init
git add .
git commit -m "Initial commit"
git push heroku master
```

### Option 3: Deploy to Your Own Server (VPS)

If you have a VPS (DigitalOcean, Linode, AWS EC2, etc.):

#### Prerequisites:
- Ubuntu/Debian server
- SSH access
- Domain name (optional but recommended)

#### Steps:

1. **Connect to Server:**
```bash
ssh user@your-server-ip
```

2. **Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install PM2 (Process Manager):**
```bash
sudo npm install -g pm2
```

4. **Upload Your Code:**
```bash
# On your local machine:
scp -r worry-free-booking user@your-server-ip:/home/user/
```

Or use Git:
```bash
# On server:
git clone your-repository-url
cd worry-free-booking
```

5. **Install Dependencies:**
```bash
cd /home/user/worry-free-booking
npm install --production
```

6. **Create .env File:**
```bash
nano .env
```
Add your environment variables and save.

7. **Start with PM2:**
```bash
pm2 start server.js --name "booking-api"
pm2 save
pm2 startup
```

8. **Set Up Nginx Reverse Proxy:**
```bash
sudo apt-get install nginx

sudo nano /etc/nginx/sites-available/booking-api
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/booking-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

9. **Add SSL Certificate (Recommended):**
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Post-Deployment

### 1. Update Chatbot

In your `Sarah AI v3.html`, update the API URL:

```javascript
const bookingState = {
    apiUrl: 'https://your-deployed-api.com/api' // Your production URL
};
```

### 2. Test Everything

- [ ] Test booking flow end-to-end
- [ ] Verify email confirmations are sent
- [ ] Check Google Calendar sync (if enabled)
- [ ] Check iCloud Calendar sync (if enabled)
- [ ] Test on mobile devices
- [ ] Test cancellation flow

### 3. Monitor

**For Vercel/Heroku:**
- Check deployment dashboard for errors
- Monitor email delivery

**For VPS:**
```bash
# View logs
pm2 logs booking-api

# Monitor status
pm2 status

# Restart if needed
pm2 restart booking-api
```

### 4. Backup

**Backup appointments data regularly:**
```bash
# On your server
cd /home/user/worry-free-booking
cp data/appointments.json backups/appointments-$(date +%Y%m%d).json
```

Set up a cron job for automatic backups:
```bash
crontab -e
```

Add this line for daily backups at midnight:
```
0 0 * * * cp /home/user/worry-free-booking/data/appointments.json /home/user/backups/appointments-$(date +\%Y\%m\%d).json
```

## Database Migration (Optional)

For production, consider migrating from JSON file storage to a proper database:

### MongoDB (Recommended)

1. **Install MongoDB:**
```bash
npm install mongodb
```

2. **Update code to use MongoDB instead of JSON files**

### PostgreSQL

1. **Install PostgreSQL:**
```bash
npm install pg
```

2. **Create appointments table:**
```sql
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    booking_id VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    date DATE,
    time TIME,
    service_type VARCHAR(255),
    pickup_address TEXT,
    dropoff_address TEXT,
    notes TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Checklist

- [ ] All environment variables are set correctly
- [ ] SSL certificate is installed (HTTPS)
- [ ] .env file is not committed to Git
- [ ] API has rate limiting (consider adding)
- [ ] Email credentials use app-specific passwords
- [ ] Google Calendar credentials are secure
- [ ] Server firewall is configured
- [ ] Regular backups are scheduled

## Maintenance

### Update the Application:

```bash
# Pull latest changes
git pull origin master

# Install any new dependencies
npm install

# Restart the server
pm2 restart booking-api
```

### Monitor Logs:

```bash
# Real-time logs
pm2 logs booking-api

# View specific log files
cat /home/user/worry-free-booking/logs/error.log
```

## Troubleshooting

### Server won't start:
- Check PM2 logs: `pm2 logs`
- Verify .env file exists and has correct values
- Check port 3001 is not in use

### Emails not sending:
- Check email credentials in .env
- Verify email service configuration
- Check spam folder
- Review server logs

### Calendar sync failing:
- Verify credentials.json and token.json exist
- Check Google Calendar API is enabled
- Review server logs for specific errors

## Support

For deployment issues:
- Email: service@worryfreemovers.com
- Check server logs first
- Review documentation in README.md

---

**Important:** Always test in a staging environment before deploying to production!
