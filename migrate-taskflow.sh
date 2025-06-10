#!/bin/bash
# migrate-taskflow.sh - TaskFlow Migration Helper Script

set -e  # Exit on any error

echo "🔄 TaskFlow Migration Script"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if old version is running
if docker ps | grep -q "taskflow-ai"; then
    print_status "Found running TaskFlow container"
    
    # Get the current container port
    CURRENT_PORT=$(docker port taskflow-ai 2>/dev/null | grep -o '0.0.0.0:[0-9]*' | cut -d: -f2 | head -n1)
    if [ -z "$CURRENT_PORT" ]; then
        CURRENT_PORT="8080"
    fi
    
    echo ""
    print_warning "IMPORTANT: You must export your data before upgrading!"
    echo ""
    echo "📋 MIGRATION STEPS:"
    echo "1. Open http://localhost:$CURRENT_PORT in your browser"
    echo "2. Go to Data Manager → Export All Data → JSON format"
    echo "3. Save the backup file to your computer"
    echo "4. Come back here and press ENTER when done..."
    echo ""
    
    read -p "Press ENTER after you've exported your data: "
    
    echo ""
    print_info "Stopping old version..."
    docker-compose down
    
    print_status "Old version stopped"
    
else
    print_info "No running TaskFlow container found"
    echo "This appears to be a fresh installation."
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_error "This script must be run from the TaskFlow git repository directory"
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
print_info "Current branch: $CURRENT_BRANCH"

# If we're on the feature branch, suggest switching to main
if [ "$CURRENT_BRANCH" = "feature/production-database" ]; then
    echo ""
    print_warning "You're on the feature branch. For production use, switch to main branch:"
    echo "git checkout main"
    echo ""
    read -p "Continue with feature branch? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Switching to main branch..."
        git checkout main
        git pull origin main
    fi
fi

# Pull latest changes
print_info "Pulling latest changes..."
git pull origin $(git branch --show-current)

# Check if package.json has the new dependencies
if grep -q "better-sqlite3" package.json; then
    print_status "Database dependencies found in package.json"
    
    # Check if node_modules exists and has the dependencies
    if [ ! -d "node_modules" ] || [ ! -d "node_modules/better-sqlite3" ]; then
        print_info "Installing Node.js dependencies..."
        npm install
        print_status "Dependencies installed"
    else
        print_status "Dependencies already installed"
    fi
else
    print_error "This doesn't appear to be the database version of TaskFlow"
    print_info "Make sure you're on the correct branch with database support"
    exit 1
fi

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    mkdir -p data
    print_status "Created data directory"
fi

# Start new version
print_info "Starting new TaskFlow version..."
docker-compose up -d

# Wait a moment for the container to start
sleep 5

# Check if the new version is running
if docker ps | grep -q "taskflow-ai"; then
    print_status "New TaskFlow version is running!"
    
    # Get the new port
    NEW_PORT=$(docker port taskflow-ai 2>/dev/null | grep -o '0.0.0.0:[0-9]*' | cut -d: -f2 | head -n1)
    if [ -z "$NEW_PORT" ]; then
        NEW_PORT="8080"
    fi
    
    echo ""
    echo "🎉 Migration Complete!"
    echo "===================="
    echo ""
    print_status "TaskFlow is now available at: http://localhost:$NEW_PORT"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Open http://localhost:$NEW_PORT in your browser"
    echo "2. Choose one of the following:"
    echo "   • Create an account (recommended for cross-device sync)"
    echo "   • Continue as guest (localStorage only)"
    echo "3. If you exported data earlier:"
    echo "   • Go to Data Manager → Import"
    echo "   • Select your exported JSON file"
    echo "   • Verify your data imported correctly"
    echo ""
    echo "🆕 New Features Available:"
    echo "• Cross-device synchronization (with account)"
    echo "• Persistent data storage"
    echo "• Offline support with automatic sync"
    echo "• No more data loss from browser clearing"
    echo ""
    
    # Check if the health endpoint is responding
    if curl -s http://localhost:$NEW_PORT/health > /dev/null 2>&1; then
        print_status "Health check passed - TaskFlow is ready!"
    else
        print_warning "Health check failed - TaskFlow may still be starting up"
        print_info "Wait a moment and try accessing http://localhost:$NEW_PORT"
    fi
    
else
    print_error "Failed to start new TaskFlow version"
    print_info "Check the logs with: docker-compose logs"
    exit 1
fi

echo ""
print_info "Migration script completed successfully!"
