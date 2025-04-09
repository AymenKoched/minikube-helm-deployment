# React + Express Fullstack App Deployment Guide

This guide explains how to run and deploy a fullstack React and Express application in three different environments:

1. Development Mode
2. Docker Compose
3. Kubernetes with Minikube
4. Helm with Minikube
5. GitHub Actions CI

---

## Prerequisites Tools

To test and deploy this application, you will need the following tools:

- [Docker](https://docs.docker.com/engine/install/)
- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [Kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/)
- [Helm](https://helm.sh/docs/intro/install/)

---

## 1. Development Mode

In development mode, the frontend and backend run separately on different ports using `npm start`.

### Backend Setup

**File: `server.js`**
```js
const express = require('express');
const cors = require('cors');

const app = express();
const port = 7001;

app.use(cors());

app.get('/api/message', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
```

### Frontend Setup

**File: `App.js`**
```js
import logo from './logo.svg';
import './App.css';
import { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
    const [message, setMessage] = useState('');
    const host = window._env_?.REACT_APP_BACKEND_HOST || process.env.REACT_APP_BACKEND_HOST;
    const port = window._env_?.REACT_APP_BACKEND_PORT || process.env.REACT_APP_BACKEND_PORT;

    useEffect(() => {
        axios.get(`http://${host}:${port}/api/message`)
            .then(response => setMessage(response.data.message))
            .catch(error => console.error('Error fetching data:', error));
    }, [host, port]);

    return (
        <div className="App">
            <header className="App-header">
                <img src={logo} className="App-logo" alt="logo" />
                <p>{message}</p>
            </header>
        </div>
    );
}

export default App;
```

### Required `.env` in frontend
```
REACT_APP_BACKEND_HOST=localhost
REACT_APP_BACKEND_PORT=7001
```

Start both apps:
```
# In backend directory
npm install && npm start

# In frontend directory
npm install && npm start
```

---

## 2. Docker Compose

### Docker Compose File
```yaml
version: '2.3'

services:
  helm-backend:
    container_name: helm-backend
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - '7001:7001'

  helm-frontend:
    container_name: helm-frontend
    build:
      context: ./frontend
      dockerfile: Dockerfile.2
      args:
        - REACT_APP_BACKEND_HOST=localhost
        - REACT_APP_BACKEND_PORT=7001
    ports:
      - '80:80'
```

> The `args` section in `helm-frontend` is used to pass environment variables during the image build process. These are required so that React knows the correct backend host and port to connect to. Since React apps are static and compiled at build time, we need to inject these variables during the Docker build.

**Note:** React runs in the browser, so it cannot access internal Docker network names. We use `localhost` and expose backend port to the host.

Run with:
```
docker-compose -f ./docker-compose.yml up -d
```

### Backend Dockerfile
```Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 7001
CMD [ "node", "server.js" ]
```

### Frontend Dockerfile (Dockerfile.2)
```Dockerfile
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

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 3. Kubernetes with Minikube

### Dynamic Config with `config.template.js`

To make environment variables dynamic (modifiable at runtime), we use a template JavaScript file that is processed on container startup.

**File: `public/config.template.js`**
```js
window._env_ = {
    REACT_APP_BACKEND_HOST: "$REACT_APP_BACKEND_HOST",
    REACT_APP_BACKEND_PORT: "$REACT_APP_BACKEND_PORT"
};
```

**Index.html**
```html
<script src="config.js"></script>
```

### Purpose of `startup.sh`

`startup.sh` replaces placeholders in `config.template.js` with actual environment variable values at container runtime using `envsubst`, then starts the Nginx server.

**startup.sh**
```sh
#!/bin/sh

# Replace placeholders in config.template.js
if [ -f /usr/share/nginx/html/config.template.js ]; then
  envsubst < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js
fi

# Start Nginx
exec nginx -g "daemon off;"
```

### Updated Frontend Dockerfile
```Dockerfile
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
```

---

### Kubernetes Backend Configuration

**backend-deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend-pods
  template:
    metadata:
      labels:
        app: backend-pods
    spec:
      containers:
        - name: backend
          image: aymenkoched02/backend-helm-image:latest
          ports:
            - containerPort: 7001
          resources:
            requests:
              memory: "64Mi"
              cpu: "250m"
            limits:
              memory: "128Mi"
              cpu: "500m"
```

**backend-service.yaml**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  type: NodePort
  ports:
    - port: 7001
      targetPort: 7001
      nodePort: 30002
  selector:
    app: backend-pods
```

> **Why NodePort and not ClusterIP?** NodePort exposes the backend outside the cluster, which is necessary for local access from the frontend (especially with Minikube). ClusterIP is only accessible within the cluster.

### Minikube Service Exposure
```bash
minikube service backend-service
```
You will get a URL like:
```
http://127.0.0.1:41757
```

---

### Kubernetes Frontend Configuration

**frontend-deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend-pods
  template:
    metadata:
      labels:
        app: frontend-pods
    spec:
      containers:
        - name: frontend
          image: aymenkoched02/frontend-helm-image:latest
          ports:
            - containerPort: 80
          env:
            - name: REACT_APP_BACKEND_HOST
              value: "127.0.0.1"
            - name: REACT_APP_BACKEND_PORT
              value: "41757"
          resources:
            requests:
              memory: "128Mi"
              cpu: "500m"
            limits:
              memory: "256Mi"
              cpu: "1"
```

**frontend-service.yaml**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
spec:
  type: NodePort
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30001
  selector:
    app: frontend-pods
```

Expose frontend with:
```bash
minikube service frontend-service
```

---

## 4. Helm with Minikube

The Helm chart simplifies and templatizes Kubernetes deployments for both frontend and backend.

### Values.yaml Overview

We define replicas, container images, resources, and service exposure types:

- Set `service.type` to `LoadBalancer` to enable external access via `minikube tunnel`.
- Environment variables are still injected using the Helm template system.
- `REACT_APP_BACKEND_HOST=localhost` and `REACT_APP_BACKEND_PORT=7001` because `minikube tunnel` forwards LoadBalancer services to your localhost.

> Run `minikube tunnel` in a separate terminal to simulate LoadBalancer behavior locally.

```yaml
replicaCount: 3

backend:
  image:
    repository: "aymenkoched02/backend-helm-image"
    tag: "latest"
  containerPort: 7001
  resources:
    requests:
      memory: "64Mi"
      cpu: "250m"
    limits:
      memory: "128Mi"
      cpu: "500m"
  service:
    type: LoadBalancer
    port: 7001
    targetPort: 7001
    nodePort: 30001
  labels:
    app: backend
    tier: api
  podLabels:
    app: backend-pods
    tier: api

frontend:
  image:
    repository: "aymenkoched02/frontend-helm-image"
    tag: "latest"
  containerPort: 80
  env:
    REACT_APP_BACKEND_HOST: "localhost"
    REACT_APP_BACKEND_PORT: "7001"
  resources:
    requests:
      memory: "128Mi"
      cpu: "500m"
    limits:
      memory: "256Mi"
      cpu: "1"
  service:
    type: LoadBalancer
    port: 80
    targetPort: 80
    nodePort: 30002
  labels:
    app: frontend
    tier: web
  podLabels:
    app: frontend-pods
    tier: web
```

Deployments and services are generated dynamically using Helm templates. This ensures clean and scalable configuration management.

---

## 5. GitHub Actions CI/CD

We use GitHub Actions to automatically build and push Docker images when changes are pushed to the `master` branch.

### Workflow Breakdown

```yaml
name: Build and Push Docker Images

on:
  push:
    branches:
      - master

jobs:
  filter:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
    steps:
      - uses: actions/checkout@v3
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
            frontend:
              - 'frontend/**'
```

> **Purpose of `filter` job**: This job checks which folder changed (backend or frontend) and only runs the necessary jobs. This optimization speeds up CI and avoids unnecessary builds.

```yaml
  backend:
    runs-on: ubuntu-latest
    needs: filter
    if: ${{ needs.filter.outputs.backend == 'true' }}
    steps:
      - uses: actions/checkout@v3
      - uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      - run: docker build -t aymenkoched02/backend-helm-image:latest ./backend
      - run: docker push aymenkoched02/backend-helm-image:latest

  frontend:
    runs-on: ubuntu-latest
    needs: filter
    if: ${{ needs.filter.outputs.frontend == 'true' }}
    steps:
      - uses: actions/checkout@v3
      - uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      - run: docker build -t aymenkoched02/frontend-helm-image:latest ./frontend
      - run: docker push aymenkoched02/frontend-helm-image:latest
```
