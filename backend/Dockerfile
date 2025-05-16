FROM node:22.14.0
WORKDIR /app
#COPY ../cert.pem /app
COPY package*.json ./
RUN npm install
COPY . .
CMD [ "node", "Api.js" ]