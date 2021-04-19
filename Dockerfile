FROM node:14.16.1

WORKDIR /usr/src/app
RUN if [ "$server" = "media" ] ; then apt-get update ; fi
RUN if [ "$server" = "media" ] ; then apt-get install ffmpeg libavcodec-extra -y ; fi
COPY ./api/package.json ./api/package.json
COPY ./api/src/ ./api/src/
COPY ./api/package-lock.json ./api/package-lock.json
COPY ./api/tsconfig.json ./api/tsconfig.json
RUN echo "copy package files!"
RUN npm install -g npm@6.14.12
RUN npm install --prefix ./api

ENV ACCOUNT_PORT=3000
ENV SVE_PORT=3001
ENV GAME_PORT=3002
ENV AI_PORT=3003

EXPOSE 3000
EXPOSE 3001
EXPOSE 3002
EXPOSE 3003
CMD [ "npm", "start", "--prefix", "./api"]