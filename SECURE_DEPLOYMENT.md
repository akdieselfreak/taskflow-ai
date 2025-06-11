# TaskFlow AI Secure Deployment Guide

This guide provides instructions for securely deploying TaskFlow AI on an Ubuntu 24.04 server with HTTPS support.

## Security Issues Fixed

The following security issues have been addressed in this deployment:

1. **HTTPS Support**: Added SSL/TLS encryption to protect data in transit
2. **Content Security Policy (CSP)**: Fixed CSP warnings by properly configuring security headers
3. **CORS Configuration**: Resolved Cross-Origin Resource Sharing issues
4. **Password Security**: Ensured password fields are only used on secure (HTTPS) connections
5. **Updated Dependencies**: Using Node.js 20 instead of outdated Node.js 10

## Deployment Options

You have two deployment options:

1. **Standard Deployment with SSL**: Deploy TaskFlow AI with a self-signed SSL certificate
2. **Manual Configuration**: Configure each component separately for more control

## Option 1: Standard Deployment with SSL

This is the easiest option that automatically sets up everything.

### Prerequisites

- Ubuntu 24.04 server with root or sudo access
- Internet connection for downloading packages and the application

### Deployment Steps

1. **Copy the SSL deployment script to your server**

   ```bash
   scp deploy-taskflow-ssl.sh user@your-server-ip:~/
   ```

2. **Make the script executable**

   ```bash
   chmod +x deploy-taskflow-ssl.sh
   ```

3. **Run the deployment script with sudo**

   Basic usage with auto-detected IP address:
   ```bash
   sudo ./deploy-taskflow-ssl.sh
   ```

   Or specify custom options:
   ```bash
   sudo ./deploy-taskflow-ssl.sh --ip 192.168.1.186 --port 3001 --dir /opt/my-taskflow
   ```

   Available options:
   ```
   -i, --ip IP_ADDRESS     Server IP address (default: auto-detected)
   -p, --port PORT         Port to run the application (default: 3001)
   -r, --repo REPO_URL     GitHub repository URL
   -d, --dir DIRECTORY     Installation directory (default: /opt/taskflow-ai)
   -n, --node VERSION      Node.js version (default: 20)
   --no-nginx              Don't install or configure Nginx
   -h, --help              Show this help message
   ```

4. **Access TaskFlow AI**

   Once the script completes successfully, you can access TaskFlow AI at:
   
   ```
   https://your-server-ip
   ```

   Since this uses a self-signed certificate, you'll need to accept the security warning in your browser.

## Option 2: Manual Configuration

If you prefer to configure each component separately, follow these steps:

### 1. Deploy the Basic Application

First, deploy the basic application using the standard deployment script:

```bash
sudo ./deploy-taskflow.sh
```

### 2. Generate SSL Certificate

Generate a self-signed SSL certificate:

```bash
sudo ./generate-ssl-cert.sh
```

You can customize the certificate generation:

```bash
sudo ./generate-ssl-cert.sh --ip your-server-ip --output /path/to/ssl/dir
```

### 3. Configure Nginx

Install Nginx:

```bash
sudo apt install nginx
```

Copy the provided Nginx configuration:

```bash
sudo cp nginx-ssl.conf /etc/nginx/sites-available/taskflow
```

Edit the configuration to match your server's IP and SSL certificate paths:

```bash
sudo nano /etc/nginx/sites-available/taskflow
```

Enable the site:

```bash
sudo ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site if it exists
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

### 4. Update Environment Configuration

Create or update the .env file in your application directory:

```bash
sudo nano /opt/taskflow-ai/.env
```

Add the following content:

```
PORT=3001
DB_PATH=data/taskflow.db
NODE_ENV=production
CORS_ORIGIN=http://your-server-ip:3001,https://your-server-ip:3001,https://your-server-ip
EXTERNAL_HOST=your-server-ip
EXTERNAL_PORT=3001
JWT_SECRET=your-secure-random-string
```

Restart the application:

```bash
sudo systemctl restart taskflow.service
```

## Troubleshooting

### SSL Certificate Issues

If you encounter SSL certificate warnings:

1. This is normal with self-signed certificates
2. Add a security exception in your browser
3. For production, consider using Let's Encrypt for a trusted certificate

### CORS Errors

If you still see CORS errors:

1. Check the browser console for specific error messages
2. Verify that your .env file has the correct CORS_ORIGIN values
3. Make sure Nginx is properly configured with CORS headers
4. Restart both Nginx and the TaskFlow service

### Authentication Problems

If you can't log in:

1. Check that you're using HTTPS (not HTTP)
2. Verify that the JWT_SECRET is set in your .env file
3. Check the server logs: `sudo journalctl -u taskflow.service`

## Production Recommendations

For a production environment, consider these additional steps:

1. **Use a Real SSL Certificate**: Replace the self-signed certificate with one from Let's Encrypt
2. **Create a Dedicated User**: Run the application as a non-root user
3. **Database Backup**: Set up regular backups of the SQLite database
4. **Monitoring**: Implement monitoring and alerting
5. **Firewall Configuration**: Restrict access to only necessary ports

## Upgrading Node.js

If you need to upgrade Node.js:

```bash
# Install newer Node.js version
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node -v
npm -v

# Restart the service
sudo systemctl restart taskflow.service
```

## Managing the Service

The script sets up TaskFlow AI as a systemd service for easy management:

- **Check service status**:
  ```bash
  sudo systemctl status taskflow.service
  ```

- **View logs**:
  ```bash
  sudo journalctl -u taskflow.service
  ```

- **Restart the service**:
  ```bash
  sudo systemctl restart taskflow.service
  ```

- **Stop the service**:
  ```bash
  sudo systemctl stop taskflow.service
  ```

## Updating the Application

To update TaskFlow AI to the latest version:

```bash
cd /opt/taskflow-ai
sudo git pull
sudo npm install
sudo systemctl restart taskflow.service
```

## Uninstalling the Application

If you need to completely remove TaskFlow AI from your server, you can use the provided uninstall script:

1. **Download the uninstall script**

   ```bash
   wget https://raw.githubusercontent.com/akdieselfreak/taskflow-ai/main/uninstall-taskflow.sh
   chmod +x uninstall-taskflow.sh
   ```

2. **Run the uninstall script with sudo**

   Basic usage:
   ```bash
   sudo ./uninstall-taskflow.sh
   ```

   To keep your data:
   ```bash
   sudo ./uninstall-taskflow.sh --keep-data
   ```

   Available options:
   ```
   -d, --dir DIRECTORY     Installation directory to remove (default: /opt/taskflow-ai)
   -p, --port PORT         Port used by the application (default: 3001)
   -k, --keep-data         Keep the database and user data
   -h, --help              Show this help message
   ```

3. **What gets removed**

   The uninstall script will remove:
   - The TaskFlow AI application files
   - The systemd service
   - Nginx configuration (if present)
   - SSL certificates (if present)
   - Firewall rules

   It will also give you the option to remove Node.js if it was installed by the deployment script.
