# Encrypt a secret value for GitHub Actions environment secrets
# Uses X25519 + AES-256-GCM (GitHub's sealed-box format)

from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESCCM
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms
from cryptography.hazmat.backends import default_backend
import os, base64, json

pub_key_b64 = 'IflV4mV1tSlP6PL8XgU7EwhoR+XqBaNVThQLwHtwhDo='
token = 'cfat_SdYSubzTlEpKaBvp54uZsoEDQtvAxJm28gHxmcSKdd6e7027'

# Import the environment's X25519 public key (32 raw bytes)
pub_bytes = base64.b64decode(pub_key_b64)
key = X25519PublicKey.from_public_bytes(pub_bytes)

# Generate an ephemeral X25519 key pair
ephemeral = X25519PublicKey.generate()
ephemeral_public = ephemeral.public_bytes_raw()
ephemeral_private = ephemeral.private_bytes_raw()

# Compute shared secret via X25519 ECDH
shared = ephemeral.exchange(key)

# Encrypt with AES-256-CCM (24-byte nonce per RFC 8452)
nonce = os.urandom(24)
token_bytes = token.encode('utf-8')
cipher = AESCCM(shared[:16], tag_length=16)
enc = cipher.encrypt(nonce, token_bytes, None)

# Box format: ephemeral_pub(32) || nonce(24) || ciphertext || tag(16)
box = ephemeral_public + nonce + enc
encrypted = base64.b64encode(box).decode()
print(encrypted)