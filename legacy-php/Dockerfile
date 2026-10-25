# Legacy PHP "Articles" app.
# Uses PHP's built-in web server — fine for a local simulation, not for production.
FROM php:8.4-cli-alpine

WORKDIR /app
COPY . .

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8000/api/health || exit 1

# Bind to 0.0.0.0 so the server is reachable from outside the container.
CMD ["php", "-S", "0.0.0.0:8000", "router.php"]
