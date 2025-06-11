# TaskFlow AI Deployment Guide

This guide provides instructions for deploying TaskFlow AI on an Ubuntu 24.04 server.

## Prerequisites

- Ubuntu 24.04 server with root or sudo access
- Server with IP address 192.168.1.120 (or update the script with your server's IP)
- Internet connection for downloading packages and the application

## Deployment Steps

1. **Copy the deployment script to your server**

   You can use SCP, SFTP, or simply create the file directly on the server:

   ```bash
   scp deploy-taskflow.sh user@your-server-ip:~/
   ```

2. **Make the script executable**

   ```bash
   chmod +x deploy-taskflow.sh
   ```

3. **Run the deployment script with sudo**

   Basic usage with auto-detected IP address:
   ```bash
   sudo ./deploy-taskflow.sh
   ```

   Or specify custom options:
   ```bash
   sudo ./deploy-taskflow.sh --ip 192.168.1.120 --port 8080 --dir /opt/my-taskflow
   ```

   Available options:
   ```
   -i, --ip IP_ADDRESS     Server IP address (default: auto-detected)
   -p, --port PORT         Port to run the application (default: 3001)
   -r, --repo REPO_URL     GitHub repository URL
   -d, --dir DIRECTORY     Installation directory (default: /opt/taskflow-ai)
   -n, --node VERSION      Node.js version (default: 20)
   -h, --help              Show help message
   ```

   The script will:
   - Update system packages
   - Install required dependencies (Node.js, Git, SQLite)
   - Clone the TaskFlow AI repository
   - Install npm dependencies
   - Configure the server to listen on all interfaces
   - Set up a systemd service for automatic startup
   - Configure the firewall (if UFW is active)
   - Start the application

4. **Access TaskFlow AI**

   Once the script completes successfully, you can access TaskFlow AI at:
   
   ```
   http://192.168.1.120:3001
   ```

   You can access it from any device on your network.

## Managing the Service

The script sets up TaskFlow AI as a systemd service for easy management:

- **Check service status**:
  ```bash
  systemctl status taskflow.service
  ```

- **View logs**:
  ```bash
  journalctl -u taskflow.service
  ```

- **Restart the service**:
  ```bash
  systemctl restart taskflow.service
  ```

- **Stop the service**:
  ```bash
  systemctl stop taskflow.service
  ```

## Docker Deployment (Alternative)

If you prefer to use Docker for deployment, you can use the Docker deployment script:

1. **Copy the Docker deployment script to your server**

   ```bash
   scp docker-deploy.sh user@your-server-ip:~/
   ```

2. **Make the script executable**

   ```bash
   chmod +x docker-deploy.sh
   ```

3. **Run the Docker deployment script with sudo**

   Basic usage with auto-detected IP address:
   ```bash
   sudo ./docker-deploy.sh
   ```

   Or specify custom options:
   ```bash
   sudo ./docker-deploy.sh --ip 192.168.1.120 --port 8080 --dir /opt/my-taskflow --container my-taskflow
   ```

   Available options:
   ```
   -i, --ip IP_ADDRESS     Server IP address (default: auto-detected)
   -p, --port PORT         Port to run the application (default: 3001)
   -r, --repo REPO_URL     GitHub repository URL
   -d, --dir DIRECTORY     Installation directory (default: /opt/taskflow-ai)
   -c, --container NAME    Docker container name (default: taskflow-ai)
   -h, --help              Show help message
   ```

4. **Managing the Docker container**

   - **View container logs**:
     ```bash
     docker logs taskflow-ai
     ```

   - **Restart container**:
     ```bash
     docker restart taskflow-ai
     ```

   - **Stop container**:
     ```bash
     docker stop taskflow-ai
     ```

   - **Start container**:
     ```bash
     docker start taskflow-ai
     ```

## Updating the Application

### Standard Deployment

To update TaskFlow AI to the latest version with the standard deployment:

```bash
cd /opt/taskflow-ai
git pull
npm install
systemctl restart taskflow.service
```

### Docker Deployment

To update TaskFlow AI to the latest version with Docker deployment:

```bash
cd /opt/taskflow-ai
git pull
docker-compose up -d --build
```

## Customization

The deployment scripts accept command-line arguments for customization. You can also modify the default values in the scripts if needed.

For standard deployment:
```bash
sudo ./deploy-taskflow.sh --ip YOUR_IP --port YOUR_PORT --dir YOUR_DIRECTORY --node NODE_VERSION
```

For Docker deployment:
```bash
sudo ./docker-deploy.sh --ip YOUR_IP --port YOUR_PORT --dir YOUR_DIRECTORY --container CONTAINER_NAME
```

## Troubleshooting

If you encounter issues:

1. Check the application logs:
   ```bash
   journalctl -u taskflow.service
   ```

2. Verify the server is listening on all interfaces:
   ```bash
   netstat -tuln | grep 3001
   ```

3. Check if the firewall is allowing traffic on port 3001:
   ```bash
   ufw status
   ```

4. Ensure the database has proper permissions:
   ```bash
   ls -la /opt/taskflow-ai/data
   ```

## Security Considerations

- The application is configured to be accessible from any IP address. Consider implementing additional security measures like a reverse proxy with HTTPS if exposing this to the internet.
- The service runs as root by default. For production environments, consider creating a dedicated user.
