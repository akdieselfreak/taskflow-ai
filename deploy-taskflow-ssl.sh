#!/bin/bash

# TaskFlow AI Deployment Script with SSL for Ubuntu 24.04
# This script will install and run TaskFlow AI on your Ubuntu server
# with HTTPS support using a self-signed certificate

# Default variables
SERVER_IP=$(hostname -I | awk '{print $1}')
PORT=3001
REPO_URL="https://github.com/akdieselfreak/taskflow-ai.git"
APP_DIR="/opt/taskflow-ai"
NODE_VERSION="20"
USE_NGINX=true
SSL_DIR="/etc/nginx/ssl"

# Help function
function show_help {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -i, --ip IP_ADDRESS     Server IP address (default: auto-detected)"
    echo "  -p, --port PORT         Port to run the application (default: 3001)"
    echo "  -r, --repo REPO_URL     GitHub repository URL (default: akdieselfreak/taskflow-ai)"
    echo "  -d, --dir DIRECTORY     Installation directory (default: /opt/taskflow-ai)"
    echo "  -n, --node VERSION      Node.js version (default: 20)"
    echo "  --no-nginx              Don't install or configure Nginx"
    echo "  -h, --help              Show this help message"
    echo ""
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -i|--ip)
            SERVER_IP="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -r|--repo)
            REPO_URL="$2"
            shift 2
            ;;
        -d|--dir)
            APP_DIR="$2"
            shift 2
            ;;
        -n|--node)
            NODE_VERSION="$2"
            shift 2
            ;;
        --no-nginx)
            USE_NGINX=false
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            ;;
    esac
done

# Print banner
echo "=================================================="
echo "  TaskFlow AI Deployment Script with SSL for Ubuntu 24.04"
echo "  Server IP: $SERVER_IP"
echo "  Port: $PORT"
echo "  Using Nginx: $USE_NGINX"
echo "=================================================="

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script as root or with sudo"
  exit 1
fi

# Update system packages
echo "Updating system packages..."
apt update && apt upgrade -y

# Install required dependencies
echo "Installing dependencies..."
apt install -y curl git build-essential sqlite3

# Install Node.js
echo "Installing Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt install -y nodejs
  echo "Node.js $(node -v) installed successfully"
else
  echo "Node.js $(node -v) is already installed"
fi

# Install Nginx if needed
if [ "$USE_NGINX" = true ]; then
  echo "Installing Nginx..."
  apt install -y nginx openssl
  
  # Generate SSL certificate
  echo "Generating SSL certificate..."
  mkdir -p $SSL_DIR
  chmod 700 $SSL_DIR
  
  # Generate OpenSSL configuration
  cat > /tmp/taskflow-openssl.cnf << EOL
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = US
ST = State
L = City
O = TaskFlow AI
OU = IT Department
CN = $SERVER_IP

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment

[alt_names]
IP.1 = $SERVER_IP
DNS.1 = $SERVER_IP
DNS.2 = localhost
EOL

  # Generate private key and certificate
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout $SSL_DIR/taskflow.key \
    -out $SSL_DIR/taskflow.crt \
    -config /tmp/taskflow-openssl.cnf
  
  # Set proper permissions
  chmod 600 $SSL_DIR/taskflow.key
  chmod 644 $SSL_DIR/taskflow.crt
  
  # Clean up
  rm /tmp/taskflow-openssl.cnf
  
  echo "SSL certificate generated successfully"
fi

# Create app directory
echo "Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone the repository
echo "Cloning TaskFlow AI repository..."
if [ -d "$APP_DIR/.git" ]; then
  echo "Repository already exists, pulling latest changes..."
  git pull
else
  git clone $REPO_URL .
  echo "Repository cloned successfully"
fi

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Create data directory with proper permissions
echo "Setting up data directory..."
mkdir -p $APP_DIR/data
chmod 755 $APP_DIR/data

# Create environment file
echo "Creating .env file..."
cat > $APP_DIR/.env << EOL
PORT=$PORT
DB_PATH=data/taskflow.db
NODE_ENV=production
CORS_ORIGIN=http://$SERVER_IP:$PORT,https://$SERVER_IP:$PORT,https://$SERVER_IP
EXTERNAL_HOST=$SERVER_IP
EXTERNAL_PORT=$PORT
JWT_SECRET=$(openssl rand -hex 32)
EOL

# Configure Nginx if needed
if [ "$USE_NGINX" = true ]; then
  echo "Configuring Nginx..."
  
  # Create Nginx configuration
  cat > /etc/nginx/sites-available/taskflow << EOL
# TaskFlow AI Nginx Configuration with SSL

server {
    listen 80;
    server_name $SERVER_IP;
    
    # Redirect all HTTP requests to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $SERVER_IP;
    
    # SSL certificate configuration
    ssl_certificate $SSL_DIR/taskflow.crt;
    ssl_certificate_key $SSL_DIR/taskflow.key;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    
    # HSTS (optional, but recommended)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Other security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    
    # Proxy settings
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'https://$SERVER_IP' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        # Handle preflight requests
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://$SERVER_IP' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
    
    # Increase max body size for large uploads
    client_max_body_size 10M;
}
EOL

  # Enable the site
  ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/
  
  # Remove default site if it exists
  if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
  fi
  
  # Test Nginx configuration
  nginx -t
  
  # Restart Nginx
  systemctl restart nginx
  
  echo "Nginx configured successfully"
fi

# Create systemd service file
echo "Creating systemd service..."
cat > /etc/systemd/system/taskflow.service << EOL
[Unit]
Description=TaskFlow AI Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=$(which node) server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd, enable and start service
echo "Enabling and starting TaskFlow AI service..."
systemctl daemon-reload
systemctl enable taskflow.service
systemctl start taskflow.service

# Check if service is running
if systemctl is-active --quiet taskflow.service; then
  echo "TaskFlow AI service is running"
else
  echo "Failed to start TaskFlow AI service. Check logs with: journalctl -u taskflow.service"
  exit 1
fi

# Configure firewall if ufw is active
if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
  echo "Configuring firewall..."
  ufw allow $PORT/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  echo "Firewall configured to allow traffic on ports 80, 443, and $PORT"
fi

# Print success message
echo "=================================================="
if [ "$USE_NGINX" = true ]; then
  echo "  TaskFlow AI has been successfully deployed with SSL!"
  echo "  You can access it at: https://$SERVER_IP"
  echo ""
  echo "  Note: Since this is using a self-signed certificate,"
  echo "  you will need to accept the security warning in your browser."
else
  echo "  TaskFlow AI has been successfully deployed!"
  echo "  You can access it at: http://$SERVER_IP:$PORT"
fi
echo "=================================================="
echo ""
echo "Management commands:"
echo "  - Check service status: systemctl status taskflow.service"
echo "  - View logs: journalctl -u taskflow.service"
echo "  - Restart service: systemctl restart taskflow.service"
echo "  - Stop service: systemctl stop taskflow.service"
echo ""
echo "To update the application in the future, run:"
echo "  cd $APP_DIR && git pull && npm install && systemctl restart taskflow.service"
echo "=================================================="
