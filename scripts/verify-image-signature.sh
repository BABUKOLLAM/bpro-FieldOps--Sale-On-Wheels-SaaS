#!/usr/bin/env bash
# Verify Docker image signatures using cosign (keyless OIDC).
#
# Usage:
#   ./verify-image-signature.sh ghcr.io/owner/repo/vansales-backend:v1.0.0
#   ./verify-image-signature.sh ghcr.io/owner/repo/vansales-admin-web:latest
#
# This script verifies that an image was signed by GitHub Actions using the
# Sigstore cosign keyless flow. It requires:
#   - cosign installed: https://docs.sigstore.dev/cosign/installation/
#   - Internet access to fetch the signature from the registry and verify
#     against the public Sigstore trust root.

set -euo pipefail

IMAGE="${1:-}"

if [ -z "$IMAGE" ]; then
    echo "Usage: $0 <image-url>"
    echo ""
    echo "Example: $0 ghcr.io/OWNER/REPO/vansales-backend:v1.0.0"
    exit 1
fi

# Check if cosign is installed
if ! command -v cosign &> /dev/null; then
    echo "ERROR: cosign not found. Install it from:"
    echo "  https://docs.sigstore.dev/cosign/installation/"
    exit 1
fi

echo "Verifying signature for: $IMAGE"
echo ""

# Verify using GitHub OIDC issuer (keyless signing)
# COSIGN_EXPERIMENTAL enables keyless mode (certificate-based verification)
export COSIGN_EXPERIMENTAL=1

if cosign verify \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com \
    --certificate-identity-regexp "https://github.com/.*" \
    "$IMAGE"; then
    echo ""
    echo "✓ Signature verified successfully!"
    echo ""
    echo "This image was signed by GitHub Actions using:"
    echo "  - Sigstore cosign (keyless flow)"
    echo "  - GitHub OIDC issuer: https://token.actions.githubusercontent.com"
    echo "  - Trusted by: Sigstore public trust root"
    echo ""
    echo "You can safely use this image."
    exit 0
else
    echo ""
    echo "✗ Signature verification FAILED!"
    echo ""
    echo "This image either:"
    echo "  - Is not signed"
    echo "  - Was signed by an untrusted issuer"
    echo "  - The signature has been tampered with"
    echo ""
    echo "Do not use this image in production."
    exit 1
fi
