#!/usr/bin/env bash
# Create one SFTP password for an organization slug. The login is chrooted to
# uploads/{organization_id}/ in the shared invoice bucket. The slug is the
# folder under supabase/seeders/<stag|prod>. The numeric id comes from that
# organization. The password hash is stored in sftp_credentials. The identity
# provider reads it from the database.
set -euo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  echo "Usage: npm run onboard:sftp -- <stag|prod> <organization slug>" >&2
  echo "       add --rotate to replace an existing password" >&2
}

ROTATE=0
ENV=""
SLUG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotate)
      ROTATE=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$ENV" ]]; then
        ENV="$1"
      elif [[ -z "$SLUG" ]]; then
        SLUG="$1"
      else
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ ! "$ENV" =~ ^(stag|prod)$ || -z "$SLUG" ]]; then
  usage
  echo "pass stag or prod, then the organization slug from supabase/seeders/<env>/<slug>" >&2
  exit 1
fi

if [[ -z "${APP_ENV:-}" && -f "$DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$DIR/.env"
  set +a
fi
if [[ -n "${APP_ENV:-}" && "$APP_ENV" != "$ENV" ]]; then
  echo "APP_ENV is ${APP_ENV} and the command is ${ENV}. Use the same environment." >&2
  exit 1
fi
export APP_ENV="$ENV"

source "$DIR/lib.sh"
require_aws

IDP_FUNCTION="$(aws_name sftp-idp)"
IDP_ROLE="${IDP_FUNCTION}-role"
SECRET_NAME_PREFIX="invoz-${APP_ENV}/sftp/"
SERVER_PARAMETER="/invoz/${APP_ENV}/transfer-server-id"

if [[ ! "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  usage
  echo "pass the organization slug from supabase/seeders/${ENV}/<slug>" >&2
  exit 1
fi

SEED_DIR="$REPO_ROOT/supabase/seeders/$ENV/$SLUG"
if [[ ! -d "$SEED_DIR" || ! -f "$SEED_DIR/owner.json" ]]; then
  echo "seeder not found: supabase/seeders/$ENV/$SLUG" >&2
  exit 1
fi

if ! ORG_ID=$(
  cd "$REPO_ROOT/supabase" &&
  node --env-file=.env --import tsx scripts/organization-id.ts "$ENV" "$SLUG"
); then
  exit 1
fi
if [[ ! "$ORG_ID" =~ ^[0-9]+$ ]]; then
  echo "organization $SLUG has no numeric id. Run npm run onboard -- $ENV $SLUG" >&2
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

  aws iam delete-role-policy \
    --role-name "$IDP_ROLE" \
    --policy-name "${IDP_FUNCTION}-secrets" \
    >/dev/null 2>&1 || true
}

load_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    return
  fi
  local env_file="$REPO_ROOT/supabase/.env"
  if [[ ! -f "$env_file" ]]; then
    echo "supabase/.env is missing DATABASE_URL" >&2
    exit 1
  fi
  DATABASE_URL=$(ENV_PATH="$env_file" AWS_REGION="$REGION" python3 - <<'PY'
import os
from pathlib import Path
from urllib.parse import quote, urlparse

value = ""
for raw in Path(os.environ["ENV_PATH"]).read_text().splitlines():
    line = raw.strip()
    if line.startswith("export "):
        line = line[len("export "):].strip()
    if not line.startswith("DATABASE_URL="):
        continue
    value = line.split("=", 1)[1].strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        value = value[1:-1]
    break
url = urlparse(value)
host = url.hostname or ""
if host.startswith("db.") and host.endswith(".supabase.co"):
    ref = host[len("db."):-len(".supabase.co")]
    region = os.environ.get("AWS_REGION") or "ap-south-1"
    user = quote(f"postgres.{ref}", safe="")
    password = quote(url.password or "", safe="")
    value = f"postgresql://{user}:{password}@aws-0-{region}.pooler.supabase.com:5432{url.path or '/postgres'}"
if value:
    print(value)
PY
)
  if [[ -z "$DATABASE_URL" ]]; then
    echo "DATABASE_URL is missing from supabase/.env" >&2
    exit 1
  fi
}

publish_idp() {
  local package="$BUILD_DIR/sftp-idp-pkg"
  rm -rf "$package"
  mkdir -p "$package"
  python3 -m pip install --quiet --target "$package" pg8000
  cp "$DIR/sftp_idp.py" "$package/sftp_idp.py"
  rm -f "$BUILD_DIR/sftp-idp.zip"
  (cd "$package" && zip -qr "$BUILD_DIR/sftp-idp.zip" .)
  local arn="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${IDP_FUNCTION}"
  local role_arn="arn:aws:iam::${ACCOUNT_ID}:role/${IDP_ROLE}"
  local transfer_role_arn="arn:aws:iam::${ACCOUNT_ID}:role/${TRANSFER_ROLE}"
  DATABASE_URL="$DATABASE_URL" \
  TRANSFER_ROLE_ARN="$transfer_role_arn" \
  INVOICE_BUCKET="$INVOICE_BUCKET" \
  ENV_FILE="$BUILD_DIR/sftp-idp-env.json" \
  python3 - <<'PY'
import json, os
from pathlib import Path
Path(os.environ["ENV_FILE"]).write_text(json.dumps({
    "Variables": {
        "DATABASE_URL": os.environ["DATABASE_URL"],
        "TRANSFER_ROLE_ARN": os.environ["TRANSFER_ROLE_ARN"],
        "INVOICE_BUCKET": os.environ["INVOICE_BUCKET"],
    }
}))
PY

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
      --environment "file://$BUILD_DIR/sftp-idp-env.json" \
      >/dev/null
    aws lambda wait function-updated --function-name "$IDP_FUNCTION" --region "$REGION"
    echo "updated lambda $IDP_FUNCTION" >&2
  else
    retry_iam aws lambda create-function \
      --function-name "$IDP_FUNCTION" \
      --region "$REGION" \
      --runtime python3.12 \
      --handler sftp_idp.handler \
      --role "$role_arn" \
      --timeout 10 \
      --memory-size 128 \
      --zip-file "fileb://$BUILD_DIR/sftp-idp.zip" \
      --environment "file://$BUILD_DIR/sftp-idp-env.json"
    echo "created lambda $IDP_FUNCTION" >&2
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

write_uploader_env() {
  local host="$1"
  local user="$2"
  local password="$3"
  local dest="$REPO_ROOT/tools/invoice-uploader/sftp/${SLUG}.env"
  mkdir -p "$(dirname "$dest")"
  SFTP_ENV="$dest" SFTP_HOST="$host" SFTP_USER="$user" SFTP_PASSWORD="$password" python3 - <<'PY'
import os
path = os.environ["SFTP_ENV"]
body = "\n".join([
    f"SFTP_HOST={os.environ['SFTP_HOST']}",
    f"SFTP_USERNAME={os.environ['SFTP_USER']}",
    f"SFTP_PASSWORD={os.environ['SFTP_PASSWORD']}",
    "",
])
with open(path, "w", encoding="utf-8") as handle:
    handle.write(body)
os.chmod(path, 0o600)
PY
}

remember_password() {
  local host="$1"
  local password="$2"
  local config="$SEED_DIR/sftp.json"
  SFTP_CONFIG="$config" SFTP_HOST="$host" SFTP_USER="$ORG_ID" SFTP_PASSWORD="$password" python3 - <<'PY'
import json, os
path = os.environ["SFTP_CONFIG"]
body = {
    "host": os.environ["SFTP_HOST"],
    "username": os.environ["SFTP_USER"],
    "password": os.environ["SFTP_PASSWORD"],
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(body, handle, indent=2)
    handle.write("\n")
os.chmod(path, 0o600)
PY
  write_uploader_env "$host" "$ORG_ID" "$password"
}

credential_exists() {
  if (
    cd "$REPO_ROOT/supabase" &&
    node --env-file=.env --import tsx scripts/sftp-credential.ts exists "$ORG_ID"
  ); then
    return 0
  fi
  return 1
}

save_credential() {
  (
    cd "$REPO_ROOT/supabase" &&
    SFTP_PASSWORD="$1" node --env-file=.env --import tsx scripts/sftp-credential.ts save "$ORG_ID"
  )
}

remove_secrets_manager_secret() {
  local secret_name="${SECRET_NAME_PREFIX}${ORG_ID}"
  if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$REGION" >/dev/null 2>&1; then
    aws secretsmanager delete-secret \
      --secret-id "$secret_name" \
      --region "$REGION" \
      --force-delete-without-recovery \
      >/dev/null
    echo "removed secrets manager secret ${secret_name}" >&2
  fi
}

load_database_url

DB_EXISTS=0
if credential_exists; then
  DB_EXISTS=1
fi
SM_EXISTS=0
if aws secretsmanager describe-secret --secret-id "${SECRET_NAME_PREFIX}${ORG_ID}" --region "$REGION" >/dev/null 2>&1; then
  SM_EXISTS=1
fi

if [[ "$DB_EXISTS" -eq 1 && "$ROTATE" -eq 0 && "$SM_EXISTS" -eq 0 ]]; then
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
  if [[ -f "$SEED_DIR/sftp.json" ]]; then
    parsed=$(SFTP_CONFIG="$SEED_DIR/sftp.json" python3 - <<'PY'
import json, os
document = json.load(open(os.environ["SFTP_CONFIG"], encoding="utf-8"))
host = document.get("host") or ""
user = document.get("username") or ""
password = document.get("password") or ""
if host and user and password:
    print(host)
    print(user)
    print(password)
PY
)
    if [[ -n "$parsed" ]]; then
      write_uploader_env \
        "$(printf '%s\n' "$parsed" | sed -n '1p')" \
        "$(printf '%s\n' "$parsed" | sed -n '2p')" \
        "$(printf '%s\n' "$parsed" | sed -n '3p')"
      echo "sftp env tools/invoice-uploader/sftp/${SLUG}.env"
    fi
  fi
  exit 0
fi

ensure_transfer_role
ensure_idp_role

if [[ "$DB_EXISTS" -eq 0 || "$ROTATE" -eq 1 ]]; then
  PASSWORD=""
  if [[ "$ROTATE" -eq 0 && -f "$SEED_DIR/sftp.json" ]]; then
    PASSWORD=$(SFTP_CONFIG="$SEED_DIR/sftp.json" python3 - <<'PY'
import json, os
print(json.load(open(os.environ["SFTP_CONFIG"], encoding="utf-8")).get("password") or "")
PY
)
  fi
  if [[ -z "$PASSWORD" ]]; then
    PASSWORD=$(python3 -c 'import secrets; print(secrets.token_urlsafe(18))')
  fi
  save_credential "$PASSWORD"
fi

publish_idp
ensure_server

if [[ "$DB_EXISTS" -eq 0 || "$ROTATE" -eq 1 ]]; then
  HOST="${SERVER_ID}.server.transfer.${REGION}.amazonaws.com"
  remember_password "$HOST" "$PASSWORD"
  echo "password ${PASSWORD}"
fi

remove_secrets_manager_secret

: >"$BUILD_DIR/empty"
aws s3api put-object \
  --bucket "$INVOICE_BUCKET" \
  --key "uploads/${ORG_ID}/.keep" \
  --body "$BUILD_DIR/empty" \
  >/dev/null

HOST="${SERVER_ID}.server.transfer.${REGION}.amazonaws.com"
echo "sftp host ${HOST}"
echo "username ${ORG_ID}"
echo "folder uploads/${ORG_ID}/"
echo "upload /{legal_entity_id}/{branch_id}/inbound/{file}.csv"
echo "sftp config supabase/seeders/${ENV}/${SLUG}/sftp.json"
echo "sftp env tools/invoice-uploader/sftp/${SLUG}.env"
(
  cd "$REPO_ROOT/supabase" &&
  node --env-file=.env --import tsx scripts/organization-id.ts --examples "$ENV" "$SLUG"
)
