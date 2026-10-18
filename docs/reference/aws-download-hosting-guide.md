# AWS Download Hosting Guide for TSM Large Data Files

**Purpose:** Host TSM's large geospatial downloads (BAFM floodplain data, USA Structures,
GeoTIFFs, GeoJSONs, 3D Tiles, HEC-RAS models) outside the git repo, keeping
GitHub under its file-size limits (100 MB hard limit, 50 MB recommended).

**Status:** Research complete 2026-10-18. Not yet implemented — requires Anthony's
explicit approval before creating any AWS resources (no-PAYG / no-silent-charges constraint).

**Pricing sources:** AWS official pricing pages via third-party 2026 pricing guides
(egresscost.com, cloudzero.com, finout.io, blazingcdn.com). Verify against
https://aws.amazon.com/s3/pricing/ and https://aws.amazon.com/cloudfront/pricing/
before committing, as AWS adjusts rates.

---

## 1. Recommended Architecture: S3 + CloudFront (public bucket)

```
                    ┌──────────────┐
  User download ──► │  CloudFront  │ ──► S3 origin (free hop)
  (HTTPS)           │  distribution│     ┌──────────────────┐
                    │  1 TB/mo     │     │ S3 bucket        │
                    │  always-free │     │ tsm-downloads    │
                    └──────────────┘     │ us-east-1        │
                                         └──────────────────┘
```

- **S3** holds the files (versioned, checksummed).
- **CloudFront** sits in front: 1 TB/month data transfer is **always free**
  (permanent free tier, 10M requests/month included). S3→CloudFront transfer is free.
- Users download via `https://downloads.tri-state-systems-manager.org/...`
  (or the CloudFront `*.cloudfront.net` domain until DNS is set up).
- The repo stores only small **manifest files** (filename, SHA-256, size, download URL)
  plus a `download-data.sh` script — never the large binaries.

### Why this fits TSM's constraints

| Constraint | How it's satisfied |
|---|---|
| No PAYG surprises | Billing alerts + AWS Budgets (Section 5); CloudFront always-free covers expected volume |
| Open source conviction | Public S3 bucket, open formats (GeoTIFF, GeoJSON, CSV, ZIP), no login required |
| Zero lock-in | Files are plain objects with standard formats; migration = `aws s3 sync` to any S3-compatible store (Cloudflare R2, Backblaze B2, MinIO) |

---

## 2. Cost Estimates

All figures us-east-1 (N. Virginia), the cheapest region.

### 2.1 Storage (S3 Standard)

| Data volume | Monthly storage cost |
|---|---|
| 5 GB | $0.12 |
| 10 GB | $0.23 |
| 50 GB | $1.15 |
| 100 GB | $2.30 |

Rate: **$0.023/GB-month** (first 50 TB). Uploads (data IN) are free.

### 2.2 Delivery (CloudFront, US/EU)

| Monthly downloads | Cost |
|---|---|
| ≤ 1 TB (10M requests) | **$0** (always-free tier, permanent) |
| 1–2 TB | ~$85 (1 TB overage × $0.085/GB) |
| 5 TB | ~$340 |

Rate after free tier: **$0.085/GB** (first 10 TB). HTTPS requests: $0.01/10,000
after the 10M free requests. S3→CloudFront origin fetch: **free**.

### 2.3 Realistic TSM scenario

Assume 10 GB stored and 200 GB/month downloaded (generous for a niche
open-source geospatial project):

| Line item | Monthly cost |
|---|---|
| S3 storage (10 GB) | $0.23 |
| CloudFront transfer (200 GB < 1 TB free) | $0.00 |
| Requests (~50K, < 10M free) | $0.00 |
| **Total** | **≈ $0.23/month** |

**Bottom line:** under ~$1/month at realistic volumes, and $0 for transfer
until downloads exceed 1 TB/month. The cost risk is a traffic spike or abuse —
mitigated by billing alerts (Section 5) and optional WAF rate limiting.

### 2.4 Cost risks — flagged clearly

1. **Egress is the danger, not storage.** Direct S3 downloads (bypassing
   CloudFront) cost $0.09/GB after the 100 GB/month aggregated free allowance.
   Always serve through CloudFront.
2. **Request fees on tiny files.** If data is split into thousands of small
   chunks, LIST/GET request fees add up ($0.005/1,000 PUTs, $0.0004/1,000 GETs).
   Keep chunk counts in the hundreds, not millions.
3. **Cross-region transfer.** Keep bucket and users' primary CloudFront
   origin in us-east-1; cross-region replication is off by default — leave it off.
4. **Incomplete multipart uploads** accrue storage charges. Add a lifecycle rule
   to abort them after 7 days (command in Section 4).

---

## 3. AWS Open Data Sponsorship Program (apply — it's free money)

AWS will **cover storage and distribution costs** for high-value public datasets
through the Open Data Sponsorship Program. TSM's floodplain/structures/elevation
data for the Ohio–Wabash valley is a strong candidate (public-interest,
open-licensed, geospatial — the program already hosts 1,100+ datasets including
elevation and terrain tiles).

- Program page: https://aws.amazon.com/opendata/open-data-sponsorship-program/
- Registry: https://registry.opendata.aws/
- What they want: well-documented, openly licensed, non-proprietary formats,
  cloud-optimized; demonstrated community interest; tutorials/usage examples.
- Process: submit application → rolling review → decision generally within 2 weeks.
- If accepted: AWS pays the S3 + transfer bill; dataset gets listed in the Registry.

**Recommendation:** Apply for the program in parallel with the self-funded setup
below. If accepted, migrate the bucket into the sponsored program at zero cost.

---

## 4. Step-by-Step Setup (AWS CLI)

Prerequisites: AWS CLI v2 installed and `aws configure` completed with an IAM user
that has S3/CloudFront/Budgets permissions. Use us-east-1 throughout.

> Do NOT run any of this until Anthony explicitly approves creating AWS resources.

### 4.1 Create the bucket (public read, private write)

```bash
export TSM_BUCKET="tsm-downloads"
export AWS_REGION="us-east-1"

# Create bucket
aws s3api create-bucket --bucket "$TSM_BUCKET" --region "$AWS_REGION"

# Block all public access OFF for the bucket policy to work, then allow
# public reads ONLY (no public writes)
aws s3api put-public-access-block --bucket "$TSM_BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false

# Public-read bucket policy (anyone can GET objects; only the account can PUT/DELETE)
aws s3api put-bucket-policy --bucket "$TSM_BUCKET" --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::tsm-downloads/*"
  }]
}'

# Enable versioning (protects against accidental overwrite)
aws s3api put-bucket-versioning --bucket "$TSM_BUCKET" \
  --versioning-configuration Status=Enabled

# Default encryption (SSE-S3, no extra charge)
aws s3api put-bucket-encryption --bucket "$TSM_BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'

# Lifecycle: abort incomplete multipart uploads after 7 days (cost-risk #4)
aws s3api put-bucket-lifecycle-configuration --bucket "$TSM_BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "abort-incomplete-multipart",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}
    }]
  }'
```

### 4.2 Upload the chunked data

```bash
# Upload a dataset directory (chunks + manifest + reassemble script)
aws s3 sync ./data/fabrics/government-downloads/ \
  "s3://$TSM_BUCKET/government-downloads/" \
  --exclude "*.zip" \
  --metadata sha256="$(sha256sum chunks.sha256 | cut -d" " -f1)"

# Verify
aws s3 ls "s3://$TSM_BUCKET/government-downloads/" --recursive --human-readable
```

### 4.3 Create the CloudFront distribution

```bash
# Create distribution with the S3 bucket as origin (OAC = Origin Access Control
# is the modern approach; for a public bucket, a plain S3 origin also works)
aws cloudfront create-distribution --distribution-config '{
  "CallerReference": "tsm-downloads-2026",
  "Comment": "TSM public geospatial downloads",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "tsm-s3-origin",
      "DomainName": "tsm-downloads.s3.us-east-1.amazonaws.com",
      "S3OriginConfig": {"OriginAccessIdentity": ""}
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "tsm-s3-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
    },
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  },
  "PriceClass": "PriceClass_100"
}'
# CachePolicyId 658327ea-f89d-4fab-a63d-7e88639e58f6 = Managed-CachingOptimized
# PriceClass_100 = US/EU edge locations only (cheapest; fine for TSM's audience)

# Note the DomainName from the output, e.g. d1234abcd.cloudfront.net
```

### 4.4 Repo integration: manifest + download script

In the repo, replace large binaries with a manifest per dataset, e.g.
`data/fabrics/government-downloads/MANIFEST.json`:

```json
{
  "dataset": "BAFM Posey County IN",
  "base_url": "https://d1234abcd.cloudfront.net/government-downloads/",
  "files": [
    {"name": "chunks/ba fm-posey-chunk-00.zip", "sha256": "<hex>", "bytes": 26214400}
  ],
  "reassemble": "chunks/reassemble.sh"
}
```

And a `scripts/data/download-dataset.sh <name>` that fetches via curl,
verifies SHA-256, and runs the reassemble script. CI validates manifests
(checksums + URL reachability) without downloading the payload.

---

## 5. Billing Alerts (mandatory before any upload)

### 5.1 Enable billing alerts

```bash
# Billing metrics live in us-east-1 regardless of bucket region
aws cloudwatch put-metric-alarm --region us-east-1 \
  --alarm-name "tsm-billing-5usd" \
  --metric-name EstimatedCharges --namespace AWS/Billing \
  --statistic Maximum --period 21600 --evaluation-periods 1 \
  --threshold 5 --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD \
  --alarm-actions "<SNS_TOPIC_ARN>"
```

(Requires an SNS topic + email subscription first; the Billing console
"Receive Billing Alerts" preference must be enabled on the payer account —
this is a console-only toggle under Billing Preferences.)

### 5.2 AWS Budget: $2/month hard cap with alerts at 50/80/100%

```bash
aws budgets create-budget --account-id "<ACCOUNT_ID>" --budget '{
  "BudgetName": "tsm-downloads-monthly",
  "BudgetLimit": {"Amount": "2", "Unit": "USD"},
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "CostFilters": {"Service": ["Amazon Simple Storage Service", "Amazon CloudFront"]}
}' --notifications-with-subscribers '[{
  "Notification": {
    "NotificationType": "ACTUAL",
    "ComparisonOperator": "GREATER_THAN",
    "Threshold": 80,
    "ThresholdType": "PERCENTAGE"
  },
  "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "atphobia22@gmail.com"}]
}]'
```

Repeat for thresholds 50 and 100. At 100%, manually investigate before the
next cycle — there is no automatic shutoff on a public bucket, so the alert
IS the control. (For a stronger guard, add a WAF rate-based rule on the
CloudFront distribution to blunt abuse-driven spikes.)

---

## 6. Public vs Presigned URLs — decision

| Pattern | Verdict for TSM |
|---|---|
| **Public bucket + CloudFront** | ✅ Recommended. Data is public-interest and open-licensed; no login wall matches "open source as conviction." CloudFront free tier absorbs the transfer. |
| Presigned URLs | ❌ Wrong tool here. They expire, require a signing backend, and add operational complexity for zero benefit on public data. Only useful if some dataset ever needs access control. |

Keep the bucket policy public-read as in Section 4.1. If a future dataset needs
restriction, put it in a separate private prefix/bucket with presigned URLs —
don't complicate the public path.

---

## 7. Migration Path Off AWS (zero lock-in)

The design is portable by construction:

1. **Data format:** plain files (ZIP chunks, SHA-256 manifests, shell scripts).
   No AWS-proprietary packaging.
2. **Move the bytes:** `aws s3 sync s3://tsm-downloads/ ./local-mirror/` then
   `rclone sync ./local-mirror/ :s3:other-bucket` (or R2/B2/MinIO equivalents —
   all speak the S3 API).
3. **Move the CDN:** point the manifest `base_url` at the new endpoint
   (Cloudflare R2 gives free egress; Backblaze B2 similar). One-line change
   per manifest, verified by CI checksum tests.
4. **Move DNS:** update the CNAME for `downloads.tri-state-systems-manager.org`.

Estimated migration effort: under a day, mostly waiting on the sync.

### Honest alternative worth naming

**Cloudflare R2** charges $0.015/GB-month storage with **$0 egress fees** —
structurally cheaper than AWS if downloads ever grow large, and equally
S3-API-compatible. The reason to start on AWS anyway: the Open Data
Sponsorship Program (Section 3) can make the whole bill $0, and the team
already has AWS CLI profile `ATphobia22` configured. Revisit R2 if the
sponsorship application is declined AND transfer exceeds the CloudFront
free tier.

---

## 8. Free Tier Notes (as of 2026)

- **CloudFront:** 1 TB/month + 10M requests/month, **always free** (no expiry).
- **S3:** new AWS accounts (created after 2026-07-15) get **$200 in credits
  valid 6 months** instead of the old 5 GB/12-month free tier. Accounts created
  before that date keep the legacy 12-month terms (5 GB S3 + 20K GET + 2K PUT).
- Data transfer IN to S3: always free. First 100 GB/month OUT to internet
  (aggregated across services): free.

---

## 9. Checklist Before Go-Live

- [ ] Anthony approves AWS resource creation (explicit — no silent setup)
- [ ] Billing alerts + $2 budget configured and test email received
- [ ] Bucket created with public-read policy, versioning, encryption, lifecycle rule
- [ ] Datasets uploaded as chunks with SHA-256 manifests
- [ ] CloudFront distribution created (PriceClass_100, HTTPS redirect)
- [ ] `download-dataset.sh` + per-dataset manifests committed to repo
- [ ] Large binaries removed from git history (or kept only as chunked <25 MB pieces)
- [ ] Open Data Sponsorship Program application submitted
- [ ] README updated with download instructions

---

*Guide prepared 2026-10-18. Pricing verified against 2026 third-party pricing
guides; re-check https://aws.amazon.com/s3/pricing/ before provisioning.*
