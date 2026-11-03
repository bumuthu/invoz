#!/usr/bin/env bash
# Create one SFTP password for an organization. The login is chrooted to
# uploads/{organization_id}/ in the shared invoice bucket.
set -euo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [[ -z "${APP_ENV:-}" && -f "$DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$DIR/.env"
  set +a
fi
source "$DIR/lib.sh"
require_aws

IDP_FUNCTION="$(aws_name sftp-idp)"
IDP_ROLE="${IDP_FUNCTION}-role"
SECRET_PREFIX="invoz-${APP_ENV}/sftp/"
SERVER_PARAMETER="/invoz/${APP_ENV}/transfer-server-id"

usage() {
  echo "Usage: npm run onboard:sftp -- <organization id>" >&2
  echo "       npm run onboard:sftp -- --from supabase/onboarding/<slug>.result.json" >&2
  echo "       add --rotate to replace an existing password" >&2
}

ROTATE=0
FROM=""
ORG_ID="${ORGANIZATION_ID:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotate)
      ROTATE=1
      shift
      ;;
    --from)
      FROM="${2:-}"
      if [[ -z "$FROM" ]]; then
        usage
        exit 1
      fi
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      ORG_ID="$1"
      shift
      ;;
  esac
done

resolve_from() {
  if [[ -f "$1" ]]; then
    printf '%s\n' "$1"
    return
  fi
  if [[ -f "$REPO_ROOT/$1" ]]; then
    printf '%s\n' "$REPO_ROOT/$1"
    return
  fi
  echo "onboarding result not found: $1" >&2
  exit 1
}

if [[ -n "$FROM" ]]; then
  FROM=$(resolve_from "$FROM")
  ORG_ID=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["organization_id"])' "$FROM")
fi

if [[ ! "$ORG_ID" =~ ^[0-9]+$ ]]; then
  usage
  echo "organization id must be the numeric id from npm run onboard" >&2
  exit 1
fi

if ! aws s3api head-bucket --bucket "$INVOICE_BUCKET" >/dev/null 2>&1; then
  echo "create $INVOICE_BUCKET first: npm run provision:s3 -w @invoz/deployment" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"
umask 077

ensure_transfer_role() {
  if aws iam get-role --role-name "$TRANSFER_ROLE" >/dev/null 2>&1; then
    echo "iam role $TRANSFER_ROLE already exists" >&2
  else
    cat >"$BUILD_DIR/transfer-trust.json" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "transfer.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
    aws iam create-role \
      --role-name "$TRANSFER_ROLE" \
      --assume-role-policy-document "file://$BUILD_DIR/transfer-trust.json" \
      >/dev/null
    echo "created iam role $TRANSFER_ROLE" >&2
  fi

  cat >"$BUILD_DIR/transfer-s3.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::${INVOICE_BUCKET}"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:GetObjectVersion"],
      "Resource": "arn:aws:s3:::${INVOICE_BUCKET}/*"
    }
  ]
}
EOF
  aws iam put-role-policy \
    --role-name "$TRANSFER_ROLE" \
    --policy-name "${TRANSFER_ROLE}-s3" \
    --policy-document "file://$BUILD_DIR/transfer-s3.json"
}

ensure_idp_role() {
  if aws iam get-role --role-name "$IDP_ROLE" >/dev/null 2>&1; then
    echo "iam role $IDP_ROLE already exists" >&2
  else
    cat >"$BUILD_DIR/sftp-idp-trust.json" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
    aws iam create-role \
      --role-name "$IDP_ROLE" \
      --assume-role-policy-document "file://$BUILD_DIR/sftp-idp-trust.json" \
      >/dev/null
    echo "created iam role $IDP_ROLE" >&2
  fi

  aws iam attach-role-policy \
    --role-name "$IDP_ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  cat >"$BUILD_DIR/sftp-idp-secrets.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:${SECRET_PREFIX}*"
    }
  ]
}
EOF
  aws iam put-role-policy \
    --role-name "$IDP_ROLE" \
    --policy-name "${IDP_FUNCTION}-secrets" \
    --policy-document "file://$BUILD_DIR/sftp-idp-secrets.json"
}

publish_idp() {
  cp "$DIR/sftp_idp.py" "$BUILD_DIR/sftp_idp.py"
  rm -f "$BUILD_DIR/sftp-idp.zip"
  (cd "$BUILD_DIR" && zip -q sftp-idp.zip sftp_idp.py)
  local arn="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${IDP_FUNCTION}"
  local role_arn="arn:aws:iam::${ACCOUNT_ID}:role/${IDP_ROLE}"

  if aws lambda get-function --function-name "$IDP_FUNCTION" --region "$REGION" >/dev/null 2>&1; then
    aws lambda update-function-code \
      --function-name "$IDP_FUNCTION" \
      --region "$REGION" \
      --zip-file "fileb://$BUILD_DIR/sftp-idp.zip" \
      >/dev/null
    aws lambda wait function-updated --function-name "$IDP_FUNCTION" --region "$REGION"
    aws lambda update-function-configuration \
      --function-name "$IDP_FUNCTION" \
      --region "$REGION" \
      --environment "Variables={SECRET_PREFIX=${SECRET_PREFIX}}" \
      >/dev/null
    aws lambda wait function-updated --function-name "$IDP_FUNCTION" --region "$REGION"
    echo "updated lambda $IDP_FUNCTION" >&2
  else
    local attempt
    for attempt in 1 2 3 4 5 6; do
      if aws lambda create-function \
        --function-name "$IDP_FUNCTION" \
        --region "$REGION" \
        --runtime python3.12 \
        --handler sftp_idp.handler \
        --role "$role_arn" \
        --timeout 10 \
        --memory-size 128 \
        --zip-file "fileb://$BUILD_DIR/sftp-idp.zip" \
        --environment "Variables={SECRET_PREFIX=${SECRET_PREFIX}}" \
        >/dev/null; then
        echo "created lambda $IDP_FUNCTION" >&2
        break
      fi
      if [[ "$attempt" -eq 6 ]]; then
        echo "could not create $IDP_FUNCTION" >&2
        return 1
      fi
      sleep 5
    done
    aws lambda wait function-active --function-name "$IDP_FUNCTION" --region "$REGION"
  fi

  local policy
  policy=$(aws lambda get-policy --function-name "$IDP_FUNCTION" --region "$REGION" --query Policy --output text 2>/dev/null || true)
  if [[ "$policy" != *'"Sid":"transfer"'* && "$policy" != *'"Sid": "transfer"'* ]]; then
    aws lambda add-permission \
      --function-name "$IDP_FUNCTION" \
      --region "$REGION" \
      --statement-id transfer \
      --action lambda:InvokeFunction \
      --principal transfer.amazonaws.com \
      --source-account "$ACCOUNT_ID" \
      >/dev/null
  fi
  LAMBDA_ARN="$arn"
}

ensure_server() {
  local server_id=""
  server_id=$(aws ssm get-parameter \
    --name "$SERVER_PARAMETER" \
    --region "$REGION" \
    --query Parameter.Value \
    --output text 2>/dev/null || true)
  if [[ -n "$server_id" && "$server_id" != "None" ]]; then
    if ! aws transfer describe-server --server-id "$server_id" --region "$REGION" >/dev/null 2>&1; then
      server_id=""
    fi
  fi
  if [[ -z "$server_id" ]]; then
    server_id=$(aws transfer create-server \
      --region "$REGION" \
      --identity-provider-type AWS_LAMBDA \
      --identity-provider-details "Function=${LAMBDA_ARN},SftpAuthenticationMethods=PASSWORD" \
      --protocols SFTP \
      --endpoint-type PUBLIC \
      --domain S3 \
      --tags "Key=Name,Value=${TRANSFER_ROLE}" \
      --query ServerId \
      --output text)
    aws ssm put-parameter \
      --name "$SERVER_PARAMETER" \
      --region "$REGION" \
      --type String \
      --value "$server_id" \
      --overwrite \
      >/dev/null
    echo "created transfer server $server_id" >&2
  else
    echo "transfer server $server_id already exists" >&2
  fi

  local state attempt
  for attempt in $(seq 1 40); do
    state=$(aws transfer describe-server \
      --server-id "$server_id" \
      --region "$REGION" \
      --query Server.State \
      --output text)
    if [[ "$state" == "ONLINE" ]]; then
      SERVER_ID="$server_id"
      return
    fi
    if [[ "$state" == "START_FAILED" || "$state" == "STOP_FAILED" ]]; then
      echo "transfer server $server_id is $state" >&2
      return 1
    fi
    sleep 3
  done
  echo "transfer server $server_id did not become ONLINE" >&2
  return 1
}

write_secret() {
  local secret_name="$1"
  local password="$2"
  local role_arn="arn:aws:iam::${ACCOUNT_ID}:role/${TRANSFER_ROLE}"
  SECRET_NAME="$secret_name" \
  SFTP_PASSWORD="$password" \
  ROLE_ARN="$role_arn" \
  BUCKET="$INVOICE_BUCKET" \
  ORG_ID="$ORG_ID" \
  SECRET_FILE="$BUILD_DIR/sftp-secret.json" \
  python3 - <<'PY'
import hashlib, json, os, secrets
password = os.environ["SFTP_PASSWORD"]
salt = secrets.token_bytes(16)
digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
org_id = os.environ["ORG_ID"]
bucket = os.environ["BUCKET"]
policy = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["s3:ListBucket"],
            "Resource": f"arn:aws:s3:::{bucket}",
            "Condition": {"StringLike": {"s3:prefix": [f"uploads/{org_id}", f"uploads/{org_id}/*"]}},
        },
        {"Effect": "Allow", "Action": "s3:GetBucketLocation", "Resource": f"arn:aws:s3:::{bucket}"},
        {
            "Effect": "Allow",
            "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:GetObjectVersion"],
            "Resource": f"arn:aws:s3:::{bucket}/uploads/{org_id}/*",
        },
    ],
}
body = {
    "PasswordHash": f"{salt.hex()}:{digest.hex()}",
    "Role": os.environ["ROLE_ARN"],
    "HomeDirectoryType": "LOGICAL",
    "HomeDirectoryDetails": json.dumps([{"Entry": "/", "Target": f"/{bucket}/uploads/{org_id}"}]),
    "Policy": json.dumps(policy),
}
with open(os.environ["SECRET_FILE"], "w", encoding="utf-8") as handle:
    json.dump(body, handle)
PY

  if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$REGION" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value \
      --secret-id "$secret_name" \
      --region "$REGION" \
      --secret-string "file://$BUILD_DIR/sftp-secret.json" \
      >/dev/null
  else
    aws secretsmanager create-secret \
      --name "$secret_name" \
      --region "$REGION" \
      --secret-string "file://$BUILD_DIR/sftp-secret.json" \
      >/dev/null
  fi
  rm -f "$BUILD_DIR/sftp-secret.json"
}

remember_password() {
  local host="$1"
  local password="$2"
  if [[ -z "$FROM" ]]; then
    return
  fi
  FROM_PATH="$FROM" SFTP_HOST="$host" SFTP_USER="$ORG_ID" SFTP_PASSWORD="$password" python3 - <<'PY'
import json, os
path = os.environ["FROM_PATH"]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)
document["sftp_host"] = os.environ["SFTP_HOST"]
document["sftp_username"] = os.environ["SFTP_USER"]
document["sftp_password"] = os.environ["SFTP_PASSWORD"]
with open(path, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
    handle.write("\n")
os.chmod(path, 0o600)
PY
}

SECRET_NAME="${SECRET_PREFIX}${ORG_ID}"
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" >/dev/null 2>&1 && [[ "$ROTATE" -eq 0 ]]; then
  EXISTING_SERVER=$(aws ssm get-parameter \
    --name "$SERVER_PARAMETER" \
    --region "$REGION" \
    --query Parameter.Value \
    --output text 2>/dev/null || true)
  if [[ -n "$EXISTING_SERVER" && "$EXISTING_SERVER" != "None" ]]; then
    echo "sftp host ${EXISTING_SERVER}.server.transfer.${REGION}.amazonaws.com"
  fi
  echo "username ${ORG_ID}"
  echo "sftp user ${ORG_ID} already exists. Run with --rotate to replace the password."
  exit 0
fi

ensure_transfer_role
ensure_idp_role
publish_idp
ensure_server
PASSWORD=$(python3 -c 'import secrets; print(secrets.token_urlsafe(18))')
write_secret "$SECRET_NAME" "$PASSWORD"

: >"$BUILD_DIR/empty"
aws s3api put-object \
  --bucket "$INVOICE_BUCKET" \
  --key "uploads/${ORG_ID}/.keep" \
  --body "$BUILD_DIR/empty" \
  >/dev/null

HOST="${SERVER_ID}.server.transfer.${REGION}.amazonaws.com"
remember_password "$HOST" "$PASSWORD"

echo "sftp host ${HOST}"
echo "username ${ORG_ID}"
echo "password ${PASSWORD}"
echo "folder uploads/${ORG_ID}/"
echo "upload /{legal_entity_id}/{branch_id}/inbound/{file}.csv"
if [[ -n "$FROM" ]]; then
  python3 -c '
import json, sys
document = json.load(open(sys.argv[1]))
for entity in document.get("legal_entities", []):
    for branch in entity.get("branches", []):
        print(f"example /{entity[\"id\"]}/{branch[\"id\"]}/inbound/invoice.csv")
' "$FROM"
fi
