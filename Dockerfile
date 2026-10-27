# syntax=docker/dockerfile:1
#
# Production image of Nick: one image, one entrypoint.
#
#   docker run nick                         # migrate, then api + worker
#   docker run nick --modules=migrate       # migrate and exit (non-zero on errors)
#   docker run nick --modules=api           # API on $PORT (default 8080)
#   docker run nick --modules=worker        # job worker and scheduler
#
# Configuration comes from environment variables (DB_HOST, DB_PASSWORD,
# SECRET, PROFILES, ...) or from a config.ts mounted at /app/config.ts.
# PROFILES lists the profiles to install, comma separated, for example
# PROFILES=@plone/nick:core,@plone/nick:default. Without PROFILES and a
# config.ts the default profile is installed: the demo site, with an admin
# user whose password is admin.
#
# Add-ons of this repository can be built in with
# --build-arg ADDONS="packages/nick-example-addon"; projects with add-ons
# from npm build their own image with @plone/nick as a dependency.

ARG NODE_VERSION=26.2.0

# Install the production dependencies
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
RUN npm install -g corepack@latest && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/nick-example-addon/package.json ./packages/nick-example-addon/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

# Runtime image
FROM node:${NODE_VERSION}-bookworm-slim
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json pnpm-workspace.yaml knexfile.ts tsconfig.json ./
COPY --chown=node:node locales ./locales
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src ./src

# Add-ons from this repository; they import @plone/nick, which is this app
ARG ADDONS=""
COPY --chown=node:node packages ./packages
RUN mkdir -p node_modules/@plone && ln -sfn ../.. node_modules/@plone/nick && \
    for addon in $ADDONS; do \
      name=$(node -p "require('./$addon/package.json').name") && \
      mkdir -p "node_modules/$(dirname "$name")" && \
      ln -sfn "/app/$addon" "node_modules/$name" || exit 1; \
    done && \
    mkdir -p /app/var/blobstorage && chown -R node:node /app/var

USER node

# Compile the sources once at build time, so the TypeScript loader (tsx)
# starts from a warm cache
RUN NODE_ENV=development node --import tsx -e "await import('/app/src/helpers/modules/modules.ts'); await import('/app/src/app.ts'); process.exit(0)"

EXPOSE 8080

# Healthy when @health passes; processes without the api module have no HTTP
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "const m=process.env.NICK_MODULES||'all'; if(m!=='all'&&!m.split(',').includes('api'))process.exit(0); fetch('http://127.0.0.1:'+process.env.PORT+'/@health',{headers:{Accept:'application/json'}}).then(r=>r.json()).then(j=>process.exit(j.status==='fail'?1:0)).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "--import", "tsx", "scripts/nick.ts"]
CMD []
