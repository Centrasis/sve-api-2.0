FROM node:latest
ARG port
ARG server

RUN echo "setting work dir..."
WORKDIR /usr/src/app
RUN apt-get update
RUN apt-get install ffmpeg libavcodec-extra -y
COPY ./api/package.json ./api/package.json
COPY ./api/src/ ./api/src/
COPY ./sslcert/ ./api/sslcert/
COPY ./api/dist/ ./api/dist/
COPY ./api/package-lock.json ./api/package-lock.json
COPY ./api/tsconfig.json ./api/tsconfig.json
RUN echo "copy package files!"
RUN npm install --prefix ./api

ENV ACCOUNT_PORT=$port
ENV SVE_PORT=$port
ENV GAME_PORT=$port
ENV AI_PORT=$port

EXPOSE $port
CMD [ "npm", $server, "--prefix", "./api"]