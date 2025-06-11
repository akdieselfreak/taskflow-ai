# GitHub Pages Deployment Guide for TaskFlow AI

This guide explains how to deploy TaskFlow AI to GitHub Pages for frontend-only demonstration purposes.

## 🚀 Quick Deployment

### 1. Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/akdieselfreak/taskflow-ai`
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select **GitHub Actions**
5. The deployment workflow will automatically trigger on the next push

### 2. Automatic Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically:
- ✅ Build the application
- ✅ Copy all necessary files
- ✅ Deploy to GitHub Pages
- ✅ Provide a live URL

## 📋 What Gets Deployed

### Frontend Files
- `index.html` - Main application interface
- `styles.css` - Application styling
- `main.js` - Main application logic
- `manual.html` - User manual
- `core/` - Core application modules
- `ui/` - User interface components
- `features/` - Feature modules
- `services/` - Service integrations

### GitHub Pages Limitations

⚠️ **Important**: GitHub Pages only serves static files. The full application requires a backend server for:
- User authentication
- Database operations
- AI service integrations

## 🌐 Live Demo URL

Once deployed, your application will be available at:
```
https://akdieselfreak.github.io/taskflow-ai/
```

## 🔧 Configuration for GitHub Pages

### Frontend-Only Mode

The GitHub Pages deployment includes a `server-info.js` file that:
- Sets `window.GITHUB_PAGES_DEPLOYMENT = true`
- Provides configuration for frontend-only operation
- Shows appropriate messages for missing backend features

### Backend Integration

To connect the GitHub Pages frontend to a backend server:

1. **Deploy the backend** to a service like:
   - Heroku
   - Railway
   - DigitalOcean
   - AWS
   - Your own server

2. **Update the API URL** in the deployment workflow:
   ```javascript
   window.API_BASE_URL = 'https://your-backend-url.com';
   ```

3. **Configure CORS** on your backend to allow requests from:
   ```
   https://akdieselfreak.github.io
   ```

## 📁 Repository Structure for Deployment

```
taskflow-ai/
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions deployment workflow
├── core/                   # Core application modules
├── ui/                     # UI components
├── features/               # Feature modules
├── services/               # Service integrations
├── index.html              # Main application
├── styles.css              # Styling
├── main.js                 # Application logic
├── manual.html             # User manual
└── GITHUB_PAGES_DEPLOYMENT.md
```

## 🚀 Deployment Process

### Automatic Deployment
Every push to the `main` branch triggers:

1. **Build Process**
   - Install Node.js dependencies
   - Copy frontend files to build directory
   - Add GitHub Pages configuration
   - Prepare static assets

2. **Deploy Process**
   - Upload build artifacts
   - Deploy to GitHub Pages
   - Update live URL

### Manual Deployment
To manually trigger deployment:
1. Go to **Actions** tab in your repository
2. Select **Deploy TaskFlow AI to GitHub Pages**
3. Click **Run workflow**

## 🔍 Monitoring Deployment

### Check Deployment Status
1. Go to **Actions** tab in your repository
2. View the latest workflow run
3. Check for any errors in the build/deploy process

### View Live Site
- Visit: `https://akdieselfreak.github.io/taskflow-ai/`
- Check browser console for any errors
- Verify all static assets load correctly

## 🛠️ Troubleshooting

### Common Issues

#### 1. 404 Error on GitHub Pages
- Ensure GitHub Pages is enabled in repository settings
- Check that the workflow completed successfully
- Verify the `index.html` file exists in the build output

#### 2. CSS/JS Not Loading
- Check file paths in `index.html`
- Ensure all referenced files are included in the build
- Verify no absolute paths are used

#### 3. Workflow Fails
- Check the Actions tab for error details
- Ensure `package.json` and `package-lock.json` are committed
- Verify Node.js version compatibility

### Backend Connection Issues

If connecting to a backend:
1. **CORS Errors**: Configure backend CORS settings
2. **API Errors**: Check backend URL configuration
3. **Authentication**: Implement GitHub Pages-compatible auth flow

## 📝 Development vs Production

### Local Development
```bash
# Full application with backend
npm install
node server.js
# Access: http://localhost:3001
```

### GitHub Pages (Frontend Only)
```bash
# Static files only
# Access: https://akdieselfreak.github.io/taskflow-ai/
```

## 🔄 Updates and Maintenance

### Updating the Deployment
1. Make changes to your code
2. Commit and push to `main` branch
3. GitHub Actions automatically redeploys
4. Changes appear live within 2-5 minutes

### Customizing the Build
Edit `.github/workflows/deploy.yml` to:
- Add build steps
- Include additional files
- Modify deployment configuration

## 📞 Support

For deployment issues:
1. Check the [GitHub Actions documentation](https://docs.github.com/en/actions)
2. Review the [GitHub Pages documentation](https://docs.github.com/en/pages)
3. Check the repository's Issues tab
4. Review the workflow logs in the Actions tab

---

**Note**: This GitHub Pages deployment provides a frontend-only demonstration. For full functionality including authentication, database operations, and AI features, deploy the complete application with both frontend and backend components to a platform that supports Node.js applications.
