FROM node:latest
ARG server

RUN echo "setting up for: '$server'"
WORKDIR /usr/src/app
RUN if ["$server" = "media"] ; then apt-get update ; fi
RUN if ["$server" = "media"] ; then apt-get install ffmpeg libavcodec-extra -y ; fi
COPY ./api/package.json ./api/package.json
COPY ./api/src/ ./api/src/
COPY ./sslcert/ ./api/sslcert/
COPY ./api/dist/ ./api/dist/
COPY ./api/package-lock.json ./api/package-lock.json
COPY ./api/tsconfig.json ./api/tsconfig.json
RUN echo "copy package files!"
RUN npm install --prefix ./api

ENV ACCOUNT_PORT=3000
ENV SVE_PORT=3000
ENV GAME_PORT=3000
ENV AI_PORT=3000

EXPOSE 3000
CMD [ "npm", "run", "$server", "--prefix", "./api"]