FROM node:18-alpine AS builder

WORKDIR /app

ARG REACT_APP_BACKEND_HOST
ARG REACT_APP_BACKEND_PORT

ENV REACT_APP_BACKEND_HOST=${REACT_APP_BACKEND_HOST}
ENV REACT_APP_BACKEND_PORT=${REACT_APP_BACKEND_PORT}

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html

COPY public/config.template.js /usr/share/nginx/html/config.template.js
COPY startup.sh /startup.sh

RUN chmod +x /startup.sh

EXPOSE 80

CMD ["/startup.sh"]