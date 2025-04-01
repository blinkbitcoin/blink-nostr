FROM node:18-alpine AS build_image

WORKDIR /app

RUN apk update && apk add git && apk add python3 && apk add make && apk add g++ pnpm nodejs-dev

COPY ./package.json ./pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY ./src ./src

USER 1000

ARG BUILDTIME
ARG COMMITHASH
ENV BUILDTIME=${BUILDTIME}
ENV COMMITHASH=${COMMITHASH}

CMD ["node", "src/index.js"]
