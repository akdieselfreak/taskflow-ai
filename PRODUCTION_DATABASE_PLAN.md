# Production Database Migration Plan

## Current State Analysis
- **Storage**: Browser localStorage per user/session
- **Problem**: No cross-device synchronization
- **Data**: Tasks, Notes, Pending Tasks, User Configuration
- **Architecture**: Clean abstraction layer already exists

## Proposed Solution: SQLite + User Authentication

### Phase 1: Database Layer (1-2 days)
1. **Add SQLite Database**
   - Create `core/database.js` - SQLite abstraction layer
   - Design schema for multi-user support
   - Implement connection pooling and error handling

2. **Database Schema**
   ```sql
   -- Users table
   CREATE TABLE users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT UNIQUE NOT NULL,
     email TEXT UNIQUE,
     password_hash TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     last_login DATETIME
   );

   -- User sessions for device management
   CREATE TABLE user_sessions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER REFERENCES users(id),
     session_token TEXT UNIQUE NOT NULL,
     device_info TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     expires_at DATETIME NOT NULL
   );

   -- Tasks (add user_id foreign key)
   CREATE TABLE tasks (
     id TEXT PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     name TEXT NOT NULL,
     description TEXT,
     notes TEXT,
     completed BOOLEAN DEFAULT FALSE,
     postponed BOOLEAN DEFAULT FALSE,
     type TEXT DEFAULT 'quick',
     created_at DATETIME,
     completed_at DATETIME,
     postponed_at DATETIME,
     modified_at DATETIME,
     date TEXT
   );

   -- Notes (add user_id foreign key)
   CREATE TABLE notes (
     id TEXT PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     title TEXT NOT NULL,
     content TEXT,
     tags TEXT, -- JSON array
     summary TEXT,
     ai_processed BOOLEAN DEFAULT FALSE,
     extracted_tasks TEXT, -- JSON array
     created_at DATETIME,
     modified_at DATETIME
   );

   -- Pending tasks (add user_id foreign key)
   CREATE TABLE pending_tasks (
     id TEXT PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     title TEXT NOT NULL,
     context TEXT,
     confidence REAL,
     source_note_title TEXT,
     source_note_id TEXT,
     created_at DATETIME,
     extracted_from TEXT
   );

   -- User configuration
   CREATE TABLE user_config (
     user_id INTEGER PRIMARY KEY REFERENCES users(id),
     service_type TEXT,
     api_endpoint TEXT,
     api_key TEXT, -- encrypted
     model_name TEXT,
     name_variations TEXT, -- JSON array
     system_prompt TEXT,
     notes_title_prompt TEXT,
     notes_summary_prompt TEXT,
     notes_task_extraction_prompt TEXT
   );
   ```

### Phase 2: Authentication System (1 day)
1. **Simple Auth Implementation**
   - Login/Register forms
   - Session management
   - Password hashing (bcrypt)
   - JWT tokens for API authentication

2. **User Management**
   - User registration flow
   - Login/logout functionality
   - Session persistence across devices
   - Password reset (optional)

### Phase 3: API Layer (1 day)
1. **REST API Endpoints**
   ```
   POST /api/auth/register
   POST /api/auth/login
   POST /api/auth/logout
   GET  /api/user/profile
   
   GET    /api/tasks
   POST   /api/tasks
   PUT    /api/tasks/:id
   DELETE /api/tasks/:id
   
   GET    /api/notes
   POST   /api/notes
   PUT    /api/notes/:id
   DELETE /api/notes/:id
   
   GET    /api/pending-tasks
   POST   /api/pending-tasks
   PUT    /api/pending-tasks/:id
   DELETE /api/pending-tasks/:id
   ```

2. **Update Frontend**
   - Replace localStorage calls with API calls
   - Add authentication state management
   - Handle offline/online scenarios

### Phase 4: Migration & Deployment (0.5 days)
1. **Data Migration**
   - Use existing DataManager to export localStorage data
   - Import into user's database account
   - Provide migration wizard for existing users

2. **Docker Updates**
   - Add SQLite volume mounting
   - Update environment variables
   - Add database initialization scripts

## Implementation Complexity Breakdown

### Easy Parts (Leverage Existing Code)
- ✅ **Data Models**: Already well-defined in StorageManager
- ✅ **Export/Import**: DataManager handles this perfectly
- ✅ **UI Components**: No major changes needed
- ✅ **Docker Setup**: Just add database volume

### Medium Complexity
- 🔶 **Database Layer**: Straightforward SQLite implementation
- 🔶 **API Endpoints**: Standard CRUD operations
- 🔶 **Authentication**: Simple username/password system

### Potential Challenges
- 🔴 **Offline Sync**: Handling conflicts when devices go offline
- 🔴 **Real-time Updates**: Multiple devices updating simultaneously
- 🔴 **Data Migration**: Ensuring no data loss during transition

## Recommended Tech Stack Additions

```json
{
  "dependencies": {
    "better-sqlite3": "^8.7.0",    // SQLite driver
    "bcryptjs": "^2.4.3",          // Password hashing
    "jsonwebtoken": "^9.0.2",      // JWT tokens
    "express": "^4.18.2",          // API server
    "cors": "^2.8.5",              // CORS handling
    "helmet": "^7.1.0"             // Security headers
  }
}
```

## Migration Strategy

### Option 1: Gradual Migration (Recommended)
1. Add database support alongside localStorage
2. Detect if user is logged in → use database
3. If not logged in → use localStorage (existing behavior)
4. Provide "Sync to Cloud" option for existing users

### Option 2: Full Migration
1. Require all users to create accounts
2. Migrate all localStorage data during first login
3. Remove localStorage support entirely

## Estimated Timeline
- **Day 1**: Database schema + SQLite integration
- **Day 2**: Authentication system + user management
- **Day 3**: API endpoints + frontend integration
- **Day 4**: Testing, migration tools, deployment

## Benefits After Implementation
✅ **Cross-Device Sync**: Access tasks/notes from any device
✅ **Data Persistence**: No more lost data from browser clearing
✅ **User Accounts**: Personalized experience
✅ **Backup/Restore**: Automatic data backup
✅ **Scalability**: Ready for team features later
✅ **Security**: Encrypted passwords, secure sessions

## Next Steps
1. Review this plan and confirm approach
2. Set up development database
3. Begin with Phase 1: Database layer implementation
4. Test thoroughly with existing data export/import
