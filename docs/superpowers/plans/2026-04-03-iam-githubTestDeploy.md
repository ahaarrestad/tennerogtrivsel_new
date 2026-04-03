# IAM-oppsrydding for githubTestDeploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erstatt `AWSLambda_FullAccess` og `AmazonS3FullAccess` på `githubTestDeploy` med én smal inline policy som kun dekker det CI/CD-workflowen faktisk bruker.

**Architecture:** Ren IAM-endring via AWS CLI. Ingen kodeendringer i repoet. Deretter oppdateres `aws-kontaktskjema-oppsett.md` til å dokumentere det nye oppsettet. Verifisering skjer ved å se at en ny CI/CD-kjøring passerer alle steg.

**Tech Stack:** AWS CLI (IAM), GitHub Actions

---

### Task 1: Bytt ut IAM-policyer via AWS CLI

**Files:**
- Ingen kodeendringer

- [ ] **Steg 1: Fjern AWSLambda_FullAccess**

  ```bash
  aws iam detach-user-policy \
    --user-name githubTestDeploy \
    --policy-arn arn:aws:iam::aws:policy/AWSLambda_FullAccess
  ```
  Forventet: ingen output (success = stille)

- [ ] **Steg 2: Fjern AmazonS3FullAccess**

  ```bash
  aws iam detach-user-policy \
    --user-name githubTestDeploy \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
  ```
  Forventet: ingen output

- [ ] **Steg 3: Lag inline policy-fil**

  ```bash
  cat > /tmp/cicd-deploy-policy.json << 'EOF'
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "StsValidation",
        "Effect": "Allow",
        "Action": "sts:GetCallerIdentity",
        "Resource": "*"
      },
      {
        "Sid": "S3ListBuckets",
        "Effect": "Allow",
        "Action": "s3:ListBucket",
        "Resource": [
          "arn:aws:s3:::test2.aarrestad.com-se",
          "arn:aws:s3:::tennerogtrivsel-se"
        ]
      },
      {
        "Sid": "S3ObjectOperations",
        "Effect": "Allow",
        "Action": [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ],
        "Resource": [
          "arn:aws:s3:::test2.aarrestad.com-se/*",
          "arn:aws:s3:::tennerogtrivsel-se/*"
        ]
      },
      {
        "Sid": "CloudFrontInvalidation",
        "Effect": "Allow",
        "Action": "cloudfront:CreateInvalidation",
        "Resource": "arn:aws:cloudfront::382286755083:distribution/*"
      },
      {
        "Sid": "LambdaDeploy",
        "Effect": "Allow",
        "Action": [
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:GetFunction"
        ],
        "Resource": "arn:aws:lambda:eu-north-1:382286755083:function:kontakt-form-handler"
      }
    ]
  }
  EOF
  ```

- [ ] **Steg 4: Legg til inline policy**

  ```bash
  aws iam put-user-policy \
    --user-name githubTestDeploy \
    --policy-name CICDDeploy \
    --policy-document file:///tmp/cicd-deploy-policy.json
  ```
  Forventet: ingen output

- [ ] **Steg 5: Verifiser at policyen er på plass**

  ```bash
  aws iam list-user-policies --user-name githubTestDeploy
  aws iam list-attached-user-policies --user-name githubTestDeploy
  ```
  Forventet:
  - `list-user-policies`: inneholder `CICDDeploy`
  - `list-attached-user-policies`: tom liste (ingen managed policies igjen)

---

### Task 2: Verifiser at CI/CD fortsatt fungerer

**Files:**
- Ingen kodeendringer

- [ ] **Steg 1: Utløs en deploy-kjøring**

  ```bash
  gh workflow run "CI/CD" --repo $(gh repo view --json nameWithOwner -q .nameWithOwner) --ref main
  ```

- [ ] **Steg 2: Følg kjøringen**

  ```bash
  gh run list --workflow="CI/CD" --limit 1
  # Kopier run-ID og følg:
  gh run watch <run-id>
  ```

  Disse stegene er de kritiske:

  | Jobb | Steg | Forventet |
  |------|------|-----------|
  | `deploy` | Configure AWS credentials | ✅ |
  | `deploy` | Deploy to S3 TEST-SE | ✅ |
  | `deploy` | Invalidate CloudFront cache TEST | ✅ |
  | `update-lambda` | Configure AWS credentials | ✅ |
  | `update-lambda` | Deploy Lambda code | ✅ |
  | `update-lambda` | Update Lambda environment variables | ✅ |

  Hvis et steg feiler med `AccessDeniedException`: les feilmeldingen for å se hvilken action som mangler, og legg den til med:
  ```bash
  # Rediger /tmp/cicd-deploy-policy.json, legg til manglende action, og kjør på nytt:
  aws iam put-user-policy \
    --user-name githubTestDeploy \
    --policy-name CICDDeploy \
    --policy-document file:///tmp/cicd-deploy-policy.json
  ```

---

### Task 3: Oppdater aws-kontaktskjema-oppsett.md og commit

**Files:**
- Modify: `docs/guides/aws-kontaktskjema-oppsett.md` (Steg 4, IAM-seksjon for githubTestDeploy)

- [ ] **Steg 1: Erstatt den gamle IAM-seksjonen**

  Finn seksjonen `### IAM-tillatelser for githubTestDeploy (CI/CD)` og erstatt hele avsnittet med:

  ```markdown
  ### IAM-tillatelser for githubTestDeploy (CI/CD)

  CI/CD-brukeren `githubTestDeploy` bruker en smal inline policy. Kjør:

  ```bash
  cat > /tmp/cicd-deploy-policy.json << 'EOF'
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "StsValidation",
        "Effect": "Allow",
        "Action": "sts:GetCallerIdentity",
        "Resource": "*"
      },
      {
        "Sid": "S3ListBuckets",
        "Effect": "Allow",
        "Action": "s3:ListBucket",
        "Resource": [
          "arn:aws:s3:::test2.aarrestad.com-se",
          "arn:aws:s3:::tennerogtrivsel-se"
        ]
      },
      {
        "Sid": "S3ObjectOperations",
        "Effect": "Allow",
        "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
        "Resource": [
          "arn:aws:s3:::test2.aarrestad.com-se/*",
          "arn:aws:s3:::tennerogtrivsel-se/*"
        ]
      },
      {
        "Sid": "CloudFrontInvalidation",
        "Effect": "Allow",
        "Action": "cloudfront:CreateInvalidation",
        "Resource": "arn:aws:cloudfront::382286755083:distribution/*"
      },
      {
        "Sid": "LambdaDeploy",
        "Effect": "Allow",
        "Action": [
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:GetFunction"
        ],
        "Resource": "arn:aws:lambda:eu-north-1:382286755083:function:kontakt-form-handler"
      }
    ]
  }
  EOF

  aws iam detach-user-policy --user-name githubTestDeploy --policy-arn arn:aws:iam::aws:policy/AWSLambda_FullAccess
  aws iam detach-user-policy --user-name githubTestDeploy --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
  aws iam put-user-policy --user-name githubTestDeploy --policy-name CICDDeploy --policy-document file:///tmp/cicd-deploy-policy.json
  ```

  > **Merk:** `sts:GetCallerIdentity` er påkrevd av `configure-aws-credentials@v6`. `lambda:GetFunction` brukes av `aws lambda wait function-updated`.
  ```

- [ ] **Steg 2: Commit**

  ```bash
  git add docs/guides/aws-kontaktskjema-oppsett.md
  ```
  Commit-melding: `docs: oppdater IAM-guide — smal CICDDeploy-policy erstatter FullAccess`
