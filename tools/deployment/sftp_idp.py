import hashlib
import hmac
import json
import os
from urllib.parse import parse_qs, unquote, urlparse

import pg8000.native

# Same scrypt parameters as hashSecret in packages/common/src/utils/secret.ts.
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32


def verify_secret(password, stored):
    try:
        salt_hex, digest_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except ValueError:
        return False
    if len(salt) != 16 or len(expected) != SCRYPT_DKLEN:
        return False
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=SCRYPT_DKLEN)
    return hmac.compare_digest(digest, expected)


def connect():
    url = urlparse(os.environ["DATABASE_URL"])
    sslmode = (parse_qs(url.query).get("sslmode") or ["require"])[0]
    host = url.hostname or ""
    # True asks pg8000 for TLS. The Supabase chain is not in the default trust store.
    ssl_context = False if sslmode == "disable" or host in ("localhost", "127.0.0.1") else True
    database = unquote(url.path.lstrip("/")) or "postgres"
    return pg8000.native.Connection(
        user=unquote(url.username or ""),
        password=unquote(url.password or ""),
        host=host,
        port=url.port or 5432,
        database=database,
        ssl_context=ssl_context,
        timeout=5,
    )


def fetch_hash(organization_id):
    connection = connect()
    try:
        rows = connection.run(
            "select password_hash from sftp_credentials where organization_id = :organization_id",
            organization_id=int(organization_id),
        )
    finally:
        connection.close()
    if not rows:
        return ""
    return rows[0][0] or ""


def session(organization_id):
    bucket = os.environ["INVOICE_BUCKET"]
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["s3:ListBucket"],
                "Resource": f"arn:aws:s3:::{bucket}",
                "Condition": {"StringLike": {"s3:prefix": [f"uploads/{organization_id}", f"uploads/{organization_id}/*"]}},
            },
            {"Effect": "Allow", "Action": "s3:GetBucketLocation", "Resource": f"arn:aws:s3:::{bucket}"},
            {
                "Effect": "Allow",
                "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:GetObjectVersion"],
                "Resource": f"arn:aws:s3:::{bucket}/uploads/{organization_id}/*",
            },
        ],
    }
    return {
        "Role": os.environ["TRANSFER_ROLE_ARN"],
        "HomeDirectoryType": "LOGICAL",
        "HomeDirectoryDetails": json.dumps([{"Entry": "/", "Target": f"/{bucket}/uploads/{organization_id}"}]),
        "Policy": json.dumps(policy),
    }


def handler(event, _context):
    username = event.get("username") or ""
    password = event.get("password") or ""
    if not username.isdigit() or not password:
        return {}
    try:
        stored = fetch_hash(username)
    except Exception as error:
        print(f"sftp credential lookup failed: {type(error).__name__}")
        return {}
    if not stored or not verify_secret(password, stored):
        return {}
    return session(username)
