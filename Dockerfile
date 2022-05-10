FROM node:14.16.1

WORKDIR /usr/src/app
RUN apt-get update
RUN apt-get install ffmpeg libavcodec-extra -y
COPY ./api/package.json ./api/package.json
COPY ./api/src/ ./api/src/
COPY ./api/tsconfig.json ./api/tsconfig.json
RUN echo "copy package files!"
RUN npm install -g npm@8.9.0
RUN npm install --prefix ./api
RUN npm run tsc --prefix ./api

ENV ACCOUNT_PORT=3000
ENV SVE_PORT=3001
ENV GAME_PORT=3002
ENV AI_PORT=3003

EXPOSE 3000
EXPOSE 3001
EXPOSE 3002
EXPOSE 3003
CMD [ "npm", "start", "--prefix", "./api"]