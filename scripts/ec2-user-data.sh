#!/bin/bash
set -e

# Install Docker (Amazon Linux 2023)
dnf install -y docker
systemctl enable docker
systemctl start docker

# Install AWS CLI v2
dnf install -y aws-cli

ACCOUNT_ID=254053129243
REGION=ap-south-1

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Pull the image
docker pull $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/reservehub:latest

# Create .env file
cat > /home/ec2-user/.env << 'ENVEOF'
MONGODB_URI=mongodb+srv://jaswanthkanipakam:whUHnpA5lJaxnNfn@reservehubcluster.imngweh.mongodb.net/strata?retryWrites=true&w=majority&appName=ReserveHubCluster
ACCESS_TOKEN_SECRET=7f8e8a71d9d99c2d1b7d5c3f1e9a2b5c0d8e2f5b8a9c0d1e2f3a4b5c6d7e8f9a
CRON_SECRET=cr0n-s3cr3t-r3s3rv3hub-2026
PORT=10000
ENVEOF

# Run the container
docker run -d \
  --name reservehub \
  --restart unless-stopped \
  -p 80:10000 \
  --env-file /home/ec2-user/.env \
  $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/reservehub:latest
