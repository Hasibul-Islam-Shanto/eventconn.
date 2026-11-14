#!/usr/bin/env bash
# ==============================================================================
# AWS OIDC & ECR Setup Script for GitHub Actions
# Repository: Hasibul-Islam-Shanto/eventconn
# ==============================================================================
set -euo pipefail

GITHUB_ORG="${1:-Hasibul-Islam-Shanto}"
GITHUB_REPO="${2:-eventconn}"
AWS_REGION="${3:-us-east-1}"
ROLE_NAME="github-actions-eventconn-deploy-role"
OIDC_PROVIDER_URL="token.actions.githubusercontent.com"
AUDIENCE="sts.amazonaws.com"

echo "=========================================================="
echo " Setting up AWS OIDC & ECR for GitHub Actions"
echo " Repo:   ${GITHUB_ORG}/${GITHUB_REPO}"
echo " Region: ${AWS_REGION}"
echo " Role:   ${ROLE_NAME}"
echo "=========================================================="

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: ${ACCOUNT_ID}"

# 1. Ensure OIDC Provider Exists in AWS IAM
echo "--> Checking/Creating OIDC Identity Provider..."
PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_PROVIDER_URL}"

if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${PROVIDER_ARN}" >/dev/null 2>&1; then
  echo "Fetching GitHub OIDC thumbprint..."
  THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"
  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_PROVIDER_URL}" \
    --client-id-list "${AUDIENCE}" \
    --thumbprint-list "${THUMBPRINT}"
  echo "OIDC Identity Provider created successfully."
else
  echo "OIDC Identity Provider already exists."
fi

# 2. Create IAM Role with OIDC Trust Policy
echo "--> Creating IAM Role: ${ROLE_NAME}..."

cat <<EOF > /tmp/trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "${OIDC_PROVIDER_URL}:aud": "${AUDIENCE}"
        },
        "StringLike": {
          "${OIDC_PROVIDER_URL}:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

if ! aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document file:///tmp/trust-policy.json \
    --description "Role assumed by GitHub Actions for EventConn CI/CD"
  echo "IAM Role created."
else
  aws iam update-assume-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-document file:///tmp/trust-policy.json
  echo "IAM Role trust policy updated."
fi

# 3. Create and Attach Permissions Policy (ECR, EKS, SSM)
echo "--> Attaching permissions policy..."

cat <<EOF > /tmp/permissions-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuthAndPush",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:GetRepositoryPolicy",
        "ecr:DescribeRepositories",
        "ecr:ListImages",
        "ecr:DescribeImages",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EKSClusterAccess",
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "GitHubActions-EventConn-DeployPolicy" \
  --policy-document file:///tmp/permissions-policy.json

# 4. Create Amazon ECR Repositories for the 7 microservices
echo "--> Ensuring Amazon ECR Repositories exist..."
SERVICES=(
  "eventconn-frontend"
  "eventconn-api-gateway"
  "eventconn-auth-service"
  "eventconn-event-service"
  "eventconn-booking-service"
  "eventconn-notification-service"
  "eventconn-payment-service"
)

for svc in "${SERVICES[@]}"; do
  if ! aws ecr describe-repositories --repository-names "${svc}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    echo "Creating ECR repository: ${svc}..."
    aws ecr create-repository \
      --repository-name "${svc}" \
      --region "${AWS_REGION}" \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 >/dev/null
  else
    echo "ECR repository '${svc}' already exists."
  fi
done

echo ""
echo "=========================================================="
echo " Setup Completed Successfully!"
echo "=========================================================="
echo "Add this to your GitHub Repository Secrets:"
echo "  AWS_ROLE_ARN = arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo ""
echo "Add this to your GitHub Repository Variables:"
echo "  AWS_REGION   = ${AWS_REGION}"
echo "=========================================================="
