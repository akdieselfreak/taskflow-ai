# Upgrade Guide: From localStorage to Database Version

## For Existing Docker Users

### ⚠️ **IMPORTANT: Data Migration Required**

Unfortunately, existing Docker users **cannot simply update** without data migration because:

1. **Architecture Change**: Previous version used nginx + static files, new version uses Node.js + SQLite
2. **Data Location**: User data was stored in browser localStorage, not in Docker volumes
3. **Port Change**: Previous version used port 8080, new version uses port 3001

### 🔄 **Recommended Upgrade Process**

#### **Option 1: Safe Migration (Recommended)**

1. **Export Your Data First**
   ```bash
   # Keep your current version running
   # Open TaskFlow in browser
   # Go to Data Manager → Export → JSON format
   # Save the backup file
   ```

2. **Update to New Version**
   ```bash
   # Stop old container
   docker-compose down
   
   # Pull latest changes
   git pull origin main  # (after feature branch is merged)
   
   # Start new version
   docker-compose up -d
   ```

3. **Import Your Data**
   ```bash
   # Open new TaskFlow at http://localhost:8080
   # Create an account or continue as guest
   # Go to Data Manager → Import → Select your JSON file
   ```

#### **Option 2: Gradual Migration**

1. **Run Both Versions Temporarily**
   ```bash
   # Rename old docker-compose.yml
   mv docker-compose.yml docker-compose.old.yml
   
   # Get new version
   git pull origin main
   
   # Run new version on different port
   docker-compose up -d
   
   # Access old version: http://localhost:8080 (if still running)
   # Access new version: http://localhost:8080 (new port mapping)
   ```

2. **Manual Data Transfer**
   - Export from old version
   - Import to new version
   - Verify data integrity
   - Stop old version

### 🐳 **Docker Volume Considerations**

#### **Previous Version (nginx)**
```yaml
# No persistent volumes for user data
# Data stored in browser localStorage only
```

#### **New Version (Node.js + SQLite)**
```yaml
volumes:
  taskflow_data:  # Persistent SQLite database
    driver: local
```

### 📋 **Step-by-Step Migration Script**

Create this script to help users migrate:

```bash
#!/bin/bash
# migrate-taskflow.sh

echo "🔄 TaskFlow Migration Script"
echo "=============================="

# Check if old version is running
if docker ps | grep -q "taskflow-ai"; then
    echo "✅ Found running TaskFlow container"
    echo ""
    echo "📋 MIGRATION STEPS:"
    echo "1. Open http://localhost:8080 in your browser"
    echo "2. Go to Data Manager → Export All Data → JSON"
    echo "3. Save the file to your computer"
    echo "4. Press ENTER when you've exported your data..."
    read -p ""
    
    echo "🛑 Stopping old version..."
    docker-compose down
    
    echo "📥 Pulling latest version..."
    git pull origin main
    
    echo "🚀 Starting new version..."
    docker-compose up -d
    
    echo ""
    echo "✅ Migration complete!"
    echo "📍 New TaskFlow available at: http://localhost:8080"
    echo "📋 Next steps:"
    echo "   1. Create an account or continue as guest"
    echo "   2. Go to Data Manager → Import"
    echo "   3. Select your exported JSON file"
    echo "   4. Verify your data is imported correctly"
else
    echo "❌ No running TaskFlow container found"
    echo "You can directly start the new version:"
    echo "docker-compose up -d"
fi
```

### 🔧 **Automated Migration Helper**

I should also create a migration detection system in the new version:

```javascript
// In the new version, detect if user has localStorage data
// and offer automatic migration
if (hasLocalStorageData() && !isAuthenticated()) {
    showMigrationPrompt();
}
```

### ⚡ **Why Manual Migration is Necessary**

1. **Container Architecture Change**
   - Old: nginx serving static files
   - New: Node.js application server

2. **Data Storage Change**
   - Old: Browser localStorage only
   - New: SQLite database + optional localStorage

3. **Port Configuration Change**
   - Old: nginx on port 8080
   - New: Node.js on port 3001 (mapped to 8080)

4. **Volume Structure Change**
   - Old: No persistent volumes needed
   - New: Database volume required

### 🛡️ **Data Safety Measures**

1. **Export Before Upgrade**: Always export data first
2. **Backup Docker Volumes**: New version creates persistent volumes
3. **Test Import**: Verify data integrity after migration
4. **Keep Backup**: Retain exported JSON files as backup

### 📊 **Migration Timeline**

- **Preparation**: 5 minutes (export data)
- **Upgrade**: 2-3 minutes (docker commands)
- **Import**: 2 minutes (import data)
- **Verification**: 5 minutes (check data)

**Total: ~15 minutes for complete migration**

### 🎯 **Post-Migration Benefits**

After migration, users get:
- ✅ Cross-device synchronization
- ✅ Persistent data storage
- ✅ User accounts and authentication
- ✅ Automatic backups
- ✅ Offline support with sync
- ✅ No more data loss from browser clearing

### 🚨 **Important Notes**

1. **No Automatic Migration**: Due to architecture changes, automatic migration isn't possible
2. **Data Export Essential**: Users MUST export data before upgrading
3. **New Features**: The migration unlocks powerful new multi-device capabilities
4. **Backward Compatibility**: Guest mode still available for localStorage-only usage

This migration process ensures no data loss while upgrading to the much more powerful database-backed version.
