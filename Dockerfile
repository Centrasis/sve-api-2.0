FROM node:latest
RUN echo "setting work dir..."
WORKDIR /usr/src/app
RUN apt-get update
RUN apt-get install ffmpeg libavcodec-extra -y
RUN npm install -g npm@latest
COPY ./api/package.json ./api/package.json
COPY ./api/src/ ./api/src/
COPY ./sslcert/ ./api/sslcert/
COPY ./api/dist/ ./api/dist/
COPY ./api/package-lock.json ./api/package-lock.json
COPY ./api/tsconfig.json ./api/tsconfig.json
RUN echo "copy package files!"
RUN npm install --prefix ./api

EXPOSE 3000
CMD [ "npm", "start", "--prefix", "./api"]