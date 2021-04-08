FROM node:latest
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

ENV ACCOUNT_PORT=3001
ENV SVE_PORT=3000

EXPOSE 3000
EXPOSE 3001
CMD [ "npm", "start", "--prefix", "./api"]