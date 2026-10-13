#!/bin/bash

set -e

APP_DIR="/home/ubuntu/admin-panel-backend"
CONTAINER_NAME="adminpanel"
IMAGE_NAME="adminpanel"
BRANCH="main"

echo "Starting Backend Deployment..."

cd "$APP_DIR"

if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found!"
    exit 1
fi

echo "Fetching latest code..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

#echo "Pulling latest code..."
#git pull origin "$BRANCH"

echo "Stopping existing container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo "Building Docker image..."
docker build -t "$IMAGE_NAME" .

echo "Starting container..."
docker run -d --name "$CONTAINER_NAME" -p 8001:8001 --restart=always --env-file .env "$IMAGE_NAME"

echo "Waiting for container to start..."
sleep 5

echo "Running containers:"
docker ps | grep "$CONTAINER_NAME" || true

echo "Deployment completed successfully!"
