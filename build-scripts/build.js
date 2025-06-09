#!/usr/bin/env node
// build-scripts/build.js - Build script for different deployment targets

const fs = require('fs-extra');
const path = require('path');
const { minify } = require('html-minifier');

// Import build configuration
const { getBuildConfig } = require('../build-config.js');

const BUILD_TARGET = process.env.BUILD_TARGET || 'local';
const config = getBuildConfig(BUILD_TARGET);

console.log(`Building TaskFlow AI - ${config.buildInfo.version} version`);
console.log(`Target: ${BUILD_TARGET}`);
console.log(`Features: ${config.buildInfo.capabilities.join(', ')}`);

async function build() {
  try {
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'dist', BUILD_TARGET);
    await fs.ensureDir(outputDir);
    
    // Copy base files
    await copyBaseFiles(outputDir);
    
    // Process HTML files with feature flags
    await processHTMLFiles(outputDir);
    
    // Process JavaScript files with feature flags
    await processJSFiles(outputDir);
    
    // Create version-specific files
    await createVersionFiles(outputDir);
    
    // Create deployment files
    await createDeploymentFiles(outputDir);
    
    console.log(`✅ Build complete: ${outputDir}`);
    console.log(`📊 Features enabled: ${config.buildInfo.capabilities.length}`);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function copyBaseFiles(outputDir) {
  const filesToCopy = [
    'styles.css',
    'manual.html',
    'core/',
    'features/',
    'ui/',
    'services/'
  ];
  
  for (const file of filesToCopy) {
    const srcPath = path.join(__dirname, '..', file);
    const destPath = path.join(outputDir, file);
    
    if (await fs.pathExists(srcPath)) {
      await fs.copy(srcPath, destPath);
      console.log(`📁 Copied: ${file}`);
    }
  }
}

async function processHTMLFiles(outputDir) {
  // Process index.html
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = await fs.readFile(indexPath, 'utf8');
  
  // Inject build configuration
  const processedContent = injectBuildConfig(indexContent);
  
  // Minify for production
  const minifiedContent = minify(processedContent, {
    removeComments: true,
    collapseWhitespace: true,
    removeRedundantAttributes: true,
    useShortDoctype: true,
    removeEmptyAttributes: true,
    removeStyleLinkTypeAttributes: true,
    keepClosingSlash: true,
    minifyJS: true,
    minifyCSS: true
  });
  
  await fs.writeFile(path.join(outputDir, 'index.html'), minifiedContent);
  console.log(`🔧 Processed: index.html`);
}

async function processJSFiles(outputDir) {
  // Process main.js with feature flags
  const mainJSPath = path.join(__dirname, '..', 'main.js');
  const mainJSContent = await fs.readFile(mainJSPath, 'utf8');
  
  const processedJS = injectFeatureFlags(mainJSContent);
  await fs.writeFile(path.join(outputDir, 'main.js'), processedJS);
  console.log(`🔧 Processed: main.js`);
  
  // Filter service files based on target
  const servicesDir = path.join(outputDir, 'services');
  const availableServices = config.serviceConfig.availableServices;
  
  // Remove unsupported service files
  const allServiceFiles = await fs.readdir(servicesDir);
  for (const file of allServiceFiles) {
    const serviceName = file.replace('Service.js', '').toLowerCase();
    if (!availableServices.includes(serviceName) && serviceName !== 'aiservice') {
      await fs.remove(path.join(servicesDir, file));
      console.log(`🗑️  Removed: services/${file} (not supported in ${BUILD_TARGET})`);
    }
  }
}

async function createVersionFiles(outputDir) {
  // Create build-info.js
  const buildInfoContent = `
// Auto-generated build information
window.BUILD_INFO = ${JSON.stringify(config, null, 2)};
console.log('TaskFlow AI ${config.buildInfo.version} - Built ${config.buildInfo.timestamp}');
`;
  
  await fs.writeFile(path.join(outputDir, 'build-info.js'), buildInfoContent);
  
  // Create README for this build
  const readmeContent = `
# TaskFlow AI - ${config.buildInfo.version} Version

Built: ${config.buildInfo.timestamp}
Target: ${BUILD_TARGET}

## Features Enabled
${config.buildInfo.capabilities.map(cap => `- ${cap}`).join('\n')}

## Available AI Services
${config.serviceConfig.availableServices.map(service => `- ${service.toUpperCase()}`).join('\n')}

## Deployment
${BUILD_TARGET === 'cloud' ? 
  '- Deploy to any static hosting (Vercel, Netlify, GitHub Pages)\n- Requires OpenAI API key\n- No local AI service support' :
  '- Self-host on local server or Docker\n- Supports local AI services (Ollama, Open WebUI)\n- Full feature set available'
}
`;
  
  await fs.writeFile(path.join(outputDir, 'README.md'), readmeContent);
}

async function createDeploymentFiles(outputDir) {
  if (BUILD_TARGET === 'cloud') {
    // Create Vercel config
    const vercelConfig = {
      "version": 2,
      "name": "taskflow-ai-cloud",
      "builds": [
        {
          "src": "**/*",
          "use": "@vercel/static"
        }
      ],
      "routes": [
        {
          "src": "/(.*)",
          "dest": "/$1"
        }
      ],
      "headers": [
        {
          "source": "/(.*)",
          "headers": [
            {
              "key": "X-Frame-Options",
              "value": "DENY"
            },
            {
              "key": "X-Content-Type-Options",
              "value": "nosniff"
            }
          ]
        }
      ]
    };
    
    await fs.writeFile(path.join(outputDir, 'vercel.json'), JSON.stringify(vercelConfig, null, 2));
    
    // Create Netlify config
    const netlifyConfig = `
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
    
    await fs.writeFile(path.join(outputDir, '_headers'), netlifyConfig);
    
  } else {
    // Create Dockerfile for local version
    const dockerfile = `
FROM nginx:alpine

# Copy built files
COPY . /usr/share/nginx/html

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;
    
    await fs.writeFile(path.join(outputDir, 'Dockerfile'), dockerfile);
    
    // Create docker-compose.yml
    const dockerCompose = `
version: '3.8'

services:
  taskflow:
    build: .
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  # Optional: Include Ollama service
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

volumes:
  ollama_data:
`;
    
    await fs.writeFile(path.join(outputDir, 'docker-compose.yml'), dockerCompose);
  }
}

function injectBuildConfig(htmlContent) {
  // Inject build configuration script before closing head tag
  const buildScript = `<script src="build-info.js"></script>`;
  return htmlContent.replace('</head>', `  ${buildScript}\n</head>`);
}

function injectFeatureFlags(jsContent) {
  // Replace feature flag placeholders with actual values
  let processed = jsContent;
  
  Object.entries(config.features).forEach(([feature, enabled]) => {
    const placeholder = `FEATURE_${feature}`;
    processed = processed.replace(
      new RegExp(`\\b${placeholder}\\b`, 'g'), 
      enabled.toString()
    );
  });
  
  return processed;
}

// Run the build
build();
