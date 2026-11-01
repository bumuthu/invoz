#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$DEPLOY_DIR/../.." && pwd)
BUILD_DIR="$DEPLOY_DIR/.build"

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
export AWS_REGION="$REGION"
export AWS_DEFAULT_REGION="$REGION"

if [[ ! "${APP_ENV:-}" =~ ^(stag|prod)$ ]]; then
  echo "APP_ENV must be stag or prod" >&2
  exit 1
fi

aws_name() {
  printf 'invoz-%s-%s' "$APP_ENV" "$1"
}

INVOICE_BUCKET="$(aws_name invoices)"
QUEUE_NAME="$(aws_name invoicing-pipeline).fifo"
DLQ_NAME="$(aws_name invoicing-pipeline-dlq).fifo"
FUNCTION_NAME="$(aws_name invoice-engine)"
ROLE_NAME="${FUNCTION_NAME}-role"
RULE_NAME="$(aws_name s3-csv-created)"
ENGINE_FUNCTION="$(aws_name ramis-engine)"
ENGINE_ROLE="${ENGINE_FUNCTION}-role"
ENGINE_API_NAME="$ENGINE_FUNCTION"
LANDING_FUNCTION="$(aws_name landing-service)"
LANDING_ROLE="${LANDING_FUNCTION}-role"
LANDING_API_NAME="$LANDING_FUNCTION"
TRANSFER_ROLE="$(aws_name transfer)"

# stag-ramis.api.invoz.lk and stag-landing.api.invoz.lk, or ramis / landing on prod.
http_api_host() {
  local service="$1"
  case "$service" in
    ramis|landing) ;;
    *)
      echo "unknown http api: $service" >&2
      exit 1
      ;;
  esac
  if [[ "$APP_ENV" == "prod" ]]; then
    printf '%s.api.invoz.lk' "$service"
  else
    printf 'stag-%s.api.invoz.lk' "$service"
  fi
}

# Regional HTTP API custom domain. DNS is created separately; this prints the alias target.
attach_http_api_domain() {
  local domain="$1"
  local api_id="$2"
  local config mappings decision action mapping_id current target zone

  if [[ -z "${API_CERTIFICATE_ARN:-}" ]]; then
    echo "API_CERTIFICATE_ARN is required in tools/deployment/.env" >&2
    echo "use an ISSUED ACM certificate in ${REGION} that covers ${domain}" >&2
    exit 1
  fi

  CERT_ARN="$API_CERTIFICATE_ARN" CERT_REGION="$REGION" CERT_DOMAIN="$domain" python3 - <<'PY'
import json, os, subprocess, sys

arn = os.environ["CERT_ARN"]
region = os.environ["CERT_REGION"]
domain = os.environ["CERT_DOMAIN"].lower()
proc = subprocess.run(
    ["aws", "acm", "describe-certificate", "--certificate-arn", arn, "--region", region, "--output", "json"],
    capture_output=True,
    text=True,
)
if proc.returncode != 0:
    sys.stderr.write(proc.stderr or proc.stdout)
    raise SystemExit(1)
cert = json.loads(proc.stdout)["Certificate"]
if cert.get("Status") != "ISSUED":
    raise SystemExit(f"certificate {arn} is {cert.get('Status')}, not ISSUED")

def covers(name, host):
    name = name.lower()
    if name == host:
        return True
    if name.startswith("*."):
        suffix = name[1:]
        label = host[: -len(suffix)]
        return bool(label) and "." not in label and host.endswith(suffix)
    return False

names = cert.get("SubjectAlternativeNames") or []
if not any(covers(name, domain) for name in names):
    raise SystemExit(f"certificate {arn} does not cover {domain} ({', '.join(names)})")
print(f"certificate covers {domain}")
PY

  mkdir -p "$BUILD_DIR"
  config="$BUILD_DIR/domain-name.json"
  cat >"$config" <<EOF
[
  {
    "CertificateArn": "${API_CERTIFICATE_ARN}",
    "EndpointType": "REGIONAL",
    "SecurityPolicy": "TLS_1_2"
  }
]
EOF

  if aws apigatewayv2 get-domain-name --domain-name "$domain" --region "$REGION" >/dev/null 2>&1; then
    current=$(aws apigatewayv2 get-domain-name \
      --domain-name "$domain" \
      --region "$REGION" \
      --query 'DomainNameConfigurations[0].CertificateArn' \
      --output text)
    if [[ "$current" != "$API_CERTIFICATE_ARN" ]]; then
      aws apigatewayv2 update-domain-name \
        --domain-name "$domain" \
        --region "$REGION" \
        --domain-name-configurations "file://$config" \
        >/dev/null
      echo "updated certificate on $domain"
    fi
  else
    aws apigatewayv2 create-domain-name \
      --domain-name "$domain" \
      --region "$REGION" \
      --domain-name-configurations "file://$config" \
      >/dev/null
    echo "created custom domain $domain"
  fi

  mappings="$BUILD_DIR/api-mappings.json"
  aws apigatewayv2 get-api-mappings \
    --domain-name "$domain" \
    --region "$REGION" \
    --output json \
    >"$mappings"
  decision=$(API_ID="$api_id" MAPPINGS_FILE="$mappings" python3 - <<'PY'
import json, os
from pathlib import Path

data = json.loads(Path(os.environ["MAPPINGS_FILE"]).read_text())
api_id = os.environ["API_ID"]
root = next((item for item in data.get("Items") or [] if not item.get("ApiMappingKey")), None)
if root is None:
    print("create")
elif root.get("ApiId") == api_id and root.get("Stage") == "$default":
    print("keep")
else:
    print("update", root["ApiMappingId"])
PY
)
  read -r action mapping_id <<<"$decision"
  case "$action" in
    create)
      aws apigatewayv2 create-api-mapping \
        --domain-name "$domain" \
        --api-id "$api_id" \
        --stage '$default' \
        --region "$REGION" \
        >/dev/null
      echo "mapped $domain to api $api_id"
      ;;
    update)
      aws apigatewayv2 update-api-mapping \
        --domain-name "$domain" \
        --api-mapping-id "$mapping_id" \
        --api-id "$api_id" \
        --stage '$default' \
        --region "$REGION" \
        >/dev/null
      echo "remapped $domain to api $api_id"
      ;;
    keep) ;;
    *)
      echo "could not read the api mapping for $domain" >&2
      exit 1
      ;;
  esac

  read -r target zone < <(aws apigatewayv2 get-domain-name \
    --domain-name "$domain" \
    --region "$REGION" \
    --query 'DomainNameConfigurations[0].[ApiGatewayDomainName,HostedZoneId]' \
    --output text)
  if [[ -z "$target" || "$target" == "None" || -z "$zone" || "$zone" == "None" ]]; then
    echo "custom domain ${domain} has no regional target yet" >&2
    exit 1
  fi
  echo "route53 alias: ${domain} A -> ${target} (alias hosted zone ${zone})"
}

require_aws() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required" >&2
    exit 1
  fi
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  QUEUE_ARN="arn:aws:sqs:${REGION}:${ACCOUNT_ID}:${QUEUE_NAME}"
  DLQ_ARN="arn:aws:sqs:${REGION}:${ACCOUNT_ID}:${DLQ_NAME}"
  RULE_ARN="arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}"
}

queue_url() {
  aws sqs get-queue-url --queue-name "$1" --region "$REGION" --query QueueUrl --output text
}

# Publish every non-empty variable from a package .env. Required names must be present.
write_lambda_environment() {
  local env_path="$1"
  local out_path="$2"
  shift 2
  if [[ ! -f "$env_path" ]]; then
    echo "missing $env_path" >&2
    echo "copy the env.example in that directory to .env" >&2
    exit 1
  fi
  ENV_PATH="$env_path" ENV_FILE="$out_path" REQUIRED="$*" python3 - <<'PY'
import json, os
from pathlib import Path

def parse(text):
    values = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):].strip()
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        if key:
            values[key] = value
    return values

path = Path(os.environ["ENV_PATH"])
values = parse(path.read_text())
missing = [name for name in os.environ["REQUIRED"].split() if not values.get(name, "").strip()]
if missing:
    raise SystemExit(f"{path} is missing {', '.join(missing)}")
variables = {key: value for key, value in values.items() if value != ""}
Path(os.environ["ENV_FILE"]).write_text(json.dumps({"Variables": variables}))
print(f"lambda environment from {path}: {' '.join(sorted(variables))}")
PY
}

# Prisma ships a query engine that esbuild cannot inline. Generate the client, then copy it next to the bundle.
generate_prisma() {
  echo "generating Prisma client"
  (cd "$REPO_ROOT" && npm run generate -w @invoz/database)
}

pack_prisma() {
  local dest="$1"
  local root="$REPO_ROOT/node_modules"
  generate_prisma
  if [[ ! -d "$root/@prisma/client" || ! -d "$root/.prisma/client" ]]; then
    echo "missing generated Prisma client. Run npm install from the repo root." >&2
    exit 1
  fi
  rm -rf "$dest/node_modules"
  mkdir -p "$dest/node_modules/@prisma" "$dest/node_modules/.prisma"
  cp -RL "$root/@prisma/client" "$dest/node_modules/@prisma/client"
  cp -RL "$root/.prisma/client" "$dest/node_modules/.prisma/client"
  find "$dest/node_modules/.prisma/client" -name 'libquery_engine-*' ! -name '*rhel-openssl-3.0.x*' -delete
}

# A new role is not assumable, and its inline policy is not visible, for several seconds.
retry_iam() {
  local attempt output
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if output=$("$@" 2>&1); then
      return 0
    fi
    sleep 5
  done
  printf '%s\n' "$output" >&2
  echo "timed out waiting for IAM to accept the Lambda role" >&2
  return 1
}
