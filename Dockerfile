FROM node:latest
RUN echo "setting work dir..."
WORKDIR /usr/src/app
RUN apt-get update
RUN apt-get install ffmpeg libavcodec-extra openssl -y
COPY ./api/package.json ./api/package.json
COPY ./api/src/ ./api/src/
RUN mkdir ./api/sslcert/
RUN openssl req -x509 -newkey rsa:4096 -keyout api/sslcert/key.pem -out api/sslcert/cert.pem -days 365
COPY ./api/dist/ ./api/dist/
COPY ./api/package-lock.json ./api/package-lock.json
COPY ./api/tsconfig.json ./api/tsconfig.json
RUN echo "copy package files!"
RUN npm install --prefix ./api

EXPOSE 3000
CMD [ "npm", "start", "--prefix", "./api"]