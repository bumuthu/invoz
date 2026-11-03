import hashlib
import hmac
import json
import os

import boto3
from botocore.exceptions import ClientError

secrets = boto3.client("secretsmanager")
PREFIX = os.environ["SECRET_PREFIX"]


def password_matches(password, stored):
    try:
        salt_hex, hash_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
    except ValueError:
        return False
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(digest, expected)


def handler(event, _context):
    username = event.get("username") or ""
    password = event.get("password") or ""
    if not username.isdigit() or not password:
        return {}
    try:
        secret = secrets.get_secret_value(SecretId=f"{PREFIX}{username}")
    except ClientError:
        return {}
    try:
        data = json.loads(secret["SecretString"])
    except (KeyError, json.JSONDecodeError):
        return {}
    stored = data.get("PasswordHash") or ""
    if not stored or not data.get("Role") or not data.get("HomeDirectoryDetails"):
        return {}
    if not password_matches(password, stored):
        return {}
    response = {
        "Role": data["Role"],
        "HomeDirectoryType": data.get("HomeDirectoryType", "LOGICAL"),
        "HomeDirectoryDetails": data["HomeDirectoryDetails"],
    }
    if data.get("Policy"):
        response["Policy"] = data["Policy"]
    return response
