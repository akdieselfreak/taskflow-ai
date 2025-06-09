# Use nginx alpine for a lightweight web server
FROM nginx:alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy application files
COPY index.html .
COPY main.js .
COPY manual.html .
COPY styles.css .
COPY core/ ./core/
COPY features/ ./features/
COPY services/ ./services/
COPY ui/ ./ui/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S taskflow -u 1001

# Set proper permissions
RUN chown -R taskflow:nodejs /usr/share/nginx/html && \
    chown -R taskflow:nodejs /var/cache/nginx && \
    chown -R taskflow:nodejs /var/log/nginx && \
    chown -R taskflow:nodejs /etc/nginx/conf.d

# Switch to non-root user
USER taskflow

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
