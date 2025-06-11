#!/bin/bash

# Script to generate a self-signed SSL certificate for TaskFlow AI

# Default variables
IP_ADDRESS="192.168.1.186"
OUTPUT_DIR="/etc/nginx/ssl"
DAYS_VALID=365

# Help function
function show_help {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -i, --ip IP_ADDRESS     Server IP address (default: 192.168.1.186)"
    echo "  -o, --output DIRECTORY  Output directory (default: /etc/nginx/ssl)"
    echo "  -d, --days DAYS         Days the certificate is valid (default: 365)"
    echo "  -h, --help              Show this help message"
    echo ""
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -i|--ip)
            IP_ADDRESS="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -d|--days)
            DAYS_VALID="$2"
            shift 2
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
echo "  TaskFlow AI SSL Certificate Generator"
echo "  Server IP: $IP_ADDRESS"
echo "  Output Directory: $OUTPUT_DIR"
echo "  Certificate Valid for: $DAYS_VALID days"
echo "=================================================="

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script as root or with sudo"
  exit 1
fi

# Create output directory if it doesn't exist
mkdir -p $OUTPUT_DIR
chmod 700 $OUTPUT_DIR

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
CN = $IP_ADDRESS

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment

[alt_names]
IP.1 = $IP_ADDRESS
DNS.1 = $IP_ADDRESS
DNS.2 = localhost
EOL

# Generate private key and certificate
echo "Generating SSL certificate..."
openssl req -x509 -nodes -days $DAYS_VALID -newkey rsa:2048 \
  -keyout $OUTPUT_DIR/taskflow.key \
  -out $OUTPUT_DIR/taskflow.crt \
  -config /tmp/taskflow-openssl.cnf

# Set proper permissions
chmod 600 $OUTPUT_DIR/taskflow.key
chmod 644 $OUTPUT_DIR/taskflow.crt

# Clean up
rm /tmp/taskflow-openssl.cnf

echo "=================================================="
echo "  SSL Certificate generated successfully!"
echo "  Private key: $OUTPUT_DIR/taskflow.key"
echo "  Certificate: $OUTPUT_DIR/taskflow.crt"
echo "=================================================="
echo ""
echo "To use this certificate with Nginx:"
echo "1. Make sure the nginx-ssl.conf file points to these files"
echo "2. Install the certificate in your browser or add an exception"
echo "3. Restart Nginx: systemctl restart nginx"
echo "=================================================="
