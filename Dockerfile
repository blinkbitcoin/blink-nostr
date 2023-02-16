FROM node:18-alpine AS BUILD_IMAGE

WORKDIR /app

RUN apk update && apk add git && apk add python3 && apk add make && apk add g++

COPY ./package.json ./yarn.lock ./

RUN yarn install

COPY ./src ./src

USER 1000

ARG BUILDTIME
ARG COMMITHASH
ENV BUILDTIME ${BUILDTIME}
ENV COMMITHASH ${COMMITHASH}

CMD ["node", "src/index.js"]