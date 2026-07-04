#!/bin/bash
set -e

# Install Docker (Amazon Linux 2023)
dnf install -y docker
systemctl enable docker
systemctl start docker

# Install AWS CLI v2
dnf install -y aws-cli

# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# Pull the image
docker pull <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/strata:latest

# Create .env file
cat > /home/ec2-user/.env << 'ENVEOF'
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/strata?retryWrites=true&w=majority
ACCESS_TOKEN_SECRET=<your_jwt_secret>
CRON_SECRET=<your_cron_secret>
PORT=5000
ENVEOF

# Run the container
docker run -d \
  --name reservehub \
  --restart unless-stopped \
  -p 80:5000 \
  --env-file /home/ec2-user/.env \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/strata:latest
