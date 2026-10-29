# Bibellese-Dienst. Bauen vom Wurzelordner des Repos aus:
#   docker build -f service/Dockerfile -t bibellese-dienst .
# Keine npm-Pakete: Node bringt HTTP und SQLite (node:sqlite) selbst mit.

FROM node:24-alpine
WORKDIR /app
COPY service/package.json service/
COPY service/src service/src
COPY modules/bibellese/kern modules/bibellese/kern
COPY modules/bibellese/daten modules/bibellese/daten
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=3100 HOST=0.0.0.0 DATA_DIR=/data
VOLUME /data
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3100/api/extensions/bibellese/gesund >/dev/null || exit 1
CMD ["node", "service/src/server.js"]
