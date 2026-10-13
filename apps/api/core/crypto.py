"""Field-level encryption (ADR 0005). AES-256-GCM, versioned and key-id tagged.

Ciphertext format: ``v1:<key_id>:<b64 nonce>:<b64 ciphertext+tag>``. The first configured key
encrypts; every configured key can decrypt, which allows rotation without re-encrypting at once.
"""

import base64
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings
from django.db import models

_VERSION = "v1"


class DecryptionError(Exception):
    pass


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text.encode("ascii"))


def encrypt(plaintext: str) -> str:
    key_id, key = settings.FIELD_ENCRYPTION_KEYS[0]
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), key_id.encode("ascii"))
    return f"{_VERSION}:{key_id}:{_b64e(nonce)}:{_b64e(ciphertext)}"


def decrypt(token: str) -> str:
    try:
        version, key_id, nonce, ciphertext = token.split(":")
        if version != _VERSION:
            raise DecryptionError("unsupported ciphertext version")
        key = dict(settings.FIELD_ENCRYPTION_KEYS).get(key_id)
        if key is None:
            raise DecryptionError("unknown key id")
        plain = AESGCM(key).decrypt(_b64d(nonce), _b64d(ciphertext), key_id.encode("ascii"))
        return plain.decode("utf-8")
    except DecryptionError:
        raise
    except Exception as exc:  # malformed token, wrong key, tampering
        raise DecryptionError("could not decrypt value") from exc


class EncryptedTextField(models.TextField):
    """Stores text encrypted at rest. Not searchable or indexable by design."""

    def get_prep_value(self, value: Any) -> Any:
        value = super().get_prep_value(value)
        return None if value is None else encrypt(value)

    def from_db_value(self, value: Any, expression, connection) -> Any:
        return None if value is None else decrypt(value)


class EncryptedJSONField(models.TextField):
    """Stores a JSON-serialisable value encrypted at rest."""

    def get_prep_value(self, value: Any) -> Any:
        if value is None:
            return None
        return encrypt(json.dumps(value, separators=(",", ":"), ensure_ascii=False))

    def from_db_value(self, value: Any, expression, connection) -> Any:
        return None if value is None else json.loads(decrypt(value))

    def to_python(self, value: Any) -> Any:
        if isinstance(value, str):
            try:
                return json.loads(value)
            except ValueError:
                return value
        return value
