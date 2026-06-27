# ####################################################################
# FROM node:22-alpine
# RUN apk update && apk add git curl bash coreutils
# RUN corepack enable && corepack install -g pnpm@10.5.2
#
# docker build -f Dockerfile.base -t wenex/node:22-base .
# docker push wenex/node:22-base
# ####################################################################

FROM wenex/node:22-base
WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile && \
  npm run build

CMD ["node", "--stack-size=4096", "dist/server.js"]
