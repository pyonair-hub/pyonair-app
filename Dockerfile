# Pyonair Mobile App - Web Export Deployment
# Serves the pre-built Expo web export via nginx
# To rebuild: run `npx expo export --platform web` locally and commit dist/

FROM nginx:alpine

# Copy pre-built web export
COPY dist/ /usr/share/nginx/html/

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
