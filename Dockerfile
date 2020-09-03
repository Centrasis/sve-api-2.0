FROM node:latest

RUN echo "setting work dir..."
WORKDIR /usr/src/app
RUN echo "setting up webapp..."
COPY ./webapp/ ./webapp/
RUN echo "build webapp..."
RUN npm run build-dev --prefix ./webapp
COPY ./webapp/www/ ./api/public/
COPY ./webAssets/ ./api/public/
COPY ./api/package.json ./api/package.json
RUN echo "copy package .json!"
RUN npm install --prefix ./api
COPY . .

EXPOSE 3000
CMD [ "npm", "start", "--prefix", "./api"]