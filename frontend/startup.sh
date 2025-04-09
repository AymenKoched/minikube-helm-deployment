#!/bin/sh

# Replace the placeholders in config.template.js with the actual environment variable values
if [ -f /usr/share/nginx/html/config.template.js ]; then
  envsubst < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js
fi

# Start Nginx
exec nginx -g "daemon off;"