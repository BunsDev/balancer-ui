# Balancer Frontend App (v2)
Frontend Vue app for Balancer exchange and pool management.

## Development
To setup the development environment first clone the repo:
```bash
git clone https://github.com/balancer-labs/frontend-v2.git && cd frontend-v2
```

### Local env
Install dependencies:
```bash
npm install
```

Start the app:
```bash
npm run serve
```

The app should be live at [http://localhost:8080](http://localhost:8080)

### Docker
If you'd rather spin up the app in a docker container:

```bash
docker-compose up
```

The app should be live at [http://localhost:8080](http://localhost:8080)

## Self-Hosting

As we believe in decentralization at all layers, we've made it easy to host your own Balancer Frontend.

### Docker Production Image

We've created a production ready [docker image](./Dockerfile) that connects to Mainnet and runs
a pre-built version of Balancer Frontend-v2 using nginx. You'll need your own [Infura](https://infura.io), [Alchemy](https://www.alchemy.com/), and [Blocknative](https://blocknative.com) API keys in order to fetch data and make trades.

You can also specify your Portis Dapp ID if you wish to use that service, otherwise it will use a default key.

Here's an example of how to run the container. This can also be found in [scripts/run-docker.sh](./scripts/run-docker.sh).

```bash
docker run \ 
  -e INFURA_PROJECT_ID=   \ # Required
  -e ALCHEMY_KEY=         \ # Required
  -e BLOCKNATIVE_DAPP_ID= \ # Required
  -e PORTIS_DAPP_ID=      \ # Optional
  balancerfi/frontend-v2
```

### Digital Ocean Deploy

Click the button below to deploy the frontend Docker image to a new instance in your Digital Ocean account. You will be prompted to provide your Infura Project ID, Alchemy Key, and Blocknative Dapp ID as these are required for the frontend to work correctly.

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/balancer-labs/frontend-v2/tree/UI-769-one-click-deploy-to-digital-ocean)

## Design System
The app is using [Tailwind](https://tailwindcss.com/) to configure base styles. In development these styles can be viewed by running:

```bash
npm run tailwind-viewer
```
Your browser should load the app at [http://localhost:3000](http://localhost:3000).
