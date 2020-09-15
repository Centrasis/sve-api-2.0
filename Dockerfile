FROM node:latest

RUN echo "setting work dir..."
WORKDIR /usr/src/app
RUN apt-get update
RUN apt-get install ffmpeg libavcodec-extra 
#RUN echo "setting up webapp..."
#COPY ./webapp/ ./webapp/
#RUN echo "build webapp..."
#RUN npm run build-dev --prefix ./webapp
#COPY ./webapp/www/ ./api/public/
#COPY ./webAssets/ ./api/public/
COPY ./api/package.json ./api/package.json
#RUN chmod -R 777 ./api/public/
#RUN chown www-data:www-data ./api/public/*
COPY ./api/src/ ./api/src/
COPY ./api/sslcert/ ./api/sslcert/
COPY ./api/dist/ ./api/dist/
COPY ./api/package-lock.json ./api/package-lock.json
COPY ./api/tsconfig.json ./api/tsconfig.json
RUN echo "copy package files!"
RUN npm install --prefix ./api
#COPY . .

EXPOSE 3000
CMD [ "npm", "start", "--prefix", "./api"]