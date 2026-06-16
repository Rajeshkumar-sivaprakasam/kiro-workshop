---
inclusion: auto
---

# Kiro Workshop Environment

## Deployment

**ALL infrastructure MUST use CloudFormation**

**Region:** us-east-1 (unless specified)

**Auto-detect environment:**
```bash
ARN=$(aws sts get-caller-identity --query 'Arn' --output text)
[[ "$ARN" == *"WSParticipantRole"* || "$ARN" == *"Participant"* ]] && WORKSHOP=true || WORKSHOP=false
echo "✓ Account: $([ "$WORKSHOP" = true ] && echo 'Workshop Studio' || echo 'Personal') | $ARN"
```

**S3 bucket policy for CloudFront + uploads:**  
Bucket policy MUST allow CloudFront OAC (serving) AND participant role (uploads/sync). Without participant access, `aws s3 cp` and `aws s3 sync` fail.

**Workshop Studio:** Add `--role-arn arn:aws:iam::ACCOUNT_ID:role/kiro-workshop/KiroWorkshopCloudFormationServiceRole`  
**Personal Account:** Use default credentials

**Deploy command:**
```bash
aws cloudformation deploy --template-file X.yaml --stack-name kiro-Y --capabilities CAPABILITY_NAMED_IAM
```

## Requirements

**Stack naming:** `kiro-*` prefix (e.g., `kiro-chatbot-ui-stack`)  
**Resource naming:** `kiro-workshop-*` prefix (e.g., `kiro-workshop-api`)  
**IAM path:** `/kiro-workshop/`  
**Tags:** All resources need `Project: kiro-workshop`

```yaml
Tags:
  - Key: Project
    Value: kiro-workshop
```

## Services

**Allowed:** S3, CloudFront, WAF, Lambda, API Gateway, CloudWatch Logs/Alarms, SQS, SNS, KMS, Bedrock, Cognito  
**Blocked:** EC2, RDS, DynamoDB, ECS, EKS, VPC, Route53, SES, Step Functions

## Architecture Patterns

**Lambda:** Runtime python3.11, inline ZipFile code, name `kiro-workshop-*`  
**S3:** Private bucket with CloudFront OAC, name `kiro-workshop-${AWS::AccountId}`, DeletionPolicy: Retain  
**CloudFront:** Origins from S3 with OriginAccessControlId  
**Cognito:** AutoVerifiedAttributes: [email], UsernameAttributes: [email], name `kiro-workshop-*`  
**API Gateway:** REST API with Cognito authorizer  
**CloudWatch Logs:** 7-day retention, KMS encrypted

## Operations

**Update stacks:** `aws cloudformation deploy --template-file updated.yaml --stack-name kiro-X`  
**Check events:** `aws cloudformation describe-stack-events --stack-name kiro-X`  
**Delete with retention:** `aws cloudformation delete-stack --stack-name kiro-X --retain-resources R1 R2`  
**Review changes:** Create change-set → describe-change-set → execute-change-set

**Reuse scripts:** Check `infrastructure/*/deploy*.sh` and `upload*.sh` before manual commands

## Verification

**Use AWS Documentation MCP to verify:**
- CloudFormation resource properties and required fields
- AWS CLI command syntax and parameters
- Service integration configurations
- Error messages and solutions

## Common Issues

- Missing `Project=kiro-workshop` tag
- IAM path not `/kiro-workshop/`
- Stack name missing `kiro-` prefix
- Using blocked services
- Deleting/recreating instead of updating stacks
