# IAM-oppsrydding for githubTestDeploy — Design

**Goal:** Erstatt de brede `AWSLambda_FullAccess`- og `AmazonS3FullAccess`-policyene på IAM-brukeren `githubTestDeploy` med én smal inline policy som kun gir det CI/CD-workflowen faktisk trenger.

**Architecture:** Ren IAM-endring — ingen kodeendringer. Ny inline policy fjerner begge AWS-managed policies. Dekker test- og prod-ressurser i samme policy (siden brukeren foreløpig deler begge miljøer).

**Tech Stack:** AWS IAM, GitHub Actions, AWS CLI (S3, CloudFront, Lambda, STS)

---

## Bakgrunn

Forrige forsøk på å begrense tilganger feilet med `AccessDeniedException` fra `configure-aws-credentials@v6`. Årsaken er sannsynligvis at `sts:GetCallerIdentity` manglet — dette kallet brukes av actions-en for å validere credentials, og er ikke inkludert i de ressursspesifikke Lambda/S3-policyene.

## Nødvendige AWS-operasjoner

Kartlagt fra `.github/workflows/deploy.yml`:

| Jobb | AWS-kall | Action |
|------|----------|--------|
| `deploy` | `aws s3 sync` | `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` |
| `deploy` | `aws cloudfront create-invalidation` | `cloudfront:CreateInvalidation` |
| `update-lambda` | `aws lambda update-function-code` | `lambda:UpdateFunctionCode` |
| `update-lambda` | `aws lambda wait function-updated` | `lambda:GetFunction` |
| `update-lambda` | `aws lambda update-function-configuration` | `lambda:UpdateFunctionConfiguration` |
| begge | `configure-aws-credentials@v6` | `sts:GetCallerIdentity` |

## IAM-policy

Én inline policy på `githubTestDeploy`:

```json
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
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration"
      ],
      "Resource": "arn:aws:lambda:eu-north-1:382286755083:function:kontakt-form-handler"
    }
  ]
}
```

## Fremgangsmåte

1. Gå til **IAM → Users → githubTestDeploy → Permissions**
2. Fjern `AWSLambda_FullAccess` (Detach)
3. Fjern `AmazonS3FullAccess` (Detach)
4. Legg til inline policy med JSON over (navn: `CICDDeploy`)
5. Utløs en deploy-kjøring og verifiser at alle steg passerer

## Fremtidig prod-oppsett

Når `githubProdDeploy` opprettes som del av Dev-Test-Prod-oppgaven, får den samme policy-malen — kun ressurs-ARNene byttes ut. S3- og CloudFront-ressursene i policyen over (`tennerogtrivsel-se`, `arn:aws:cloudfront::...distribution/*`) kan da fjernes fra `githubTestDeploy` og legges i prod-brukerens policy.
