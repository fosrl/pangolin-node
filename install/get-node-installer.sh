#!/bin/bash

# Get installer - Cross-platform installation script
# Usage: curl -fsSL https://raw.githubusercontent.com/fosrl/installer/refs/heads/main/get-installer.sh | bash
#
# Options (pass after `bash -s --`, e.g. `... | bash -s -- --version 1.7.0`):
#   --version <version>  Download a specific release instead of the latest.
#                        Can also be set with PANGOLIN_NODE_VERSION.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# GitHub repository info
REPO="fosrl/pangolin-node"
RELEASE_API_URL="https://api.fossorial.io/api/v1/versions/pangolin-node"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# Warnings and errors go to stderr so they still show up when printed from
# inside a $(...) command substitution.
print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Temporary download directory, removed on exit. A fresh mktemp directory
# avoids clobbering (or following a symlink planted at) a fixed /tmp path.
TMP_DIR=""
cleanup() {
    if [ -n "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi
}
trap cleanup EXIT
trap 'exit 1' INT TERM

# Fetch the latest release info (version and asset checksums) from the
# Fossorial API into RELEASE_INFO. Returns 1 if it isn't available.
RELEASE_INFO=""
fetch_release_info() {
    if command -v curl >/dev/null 2>&1; then
        RELEASE_INFO=$(curl -fsSL "$RELEASE_API_URL" 2>/dev/null || true)
    else
        RELEASE_INFO=$(wget -qO- "$RELEASE_API_URL" 2>/dev/null || true)
    fi
    RELEASE_INFO=$(printf '%s' "$RELEASE_INFO" | tr -d '\n\r')
    [ -n "$RELEASE_INFO" ]
}

# latestVersion from RELEASE_INFO, without a leading "v". Parsed without jq.
release_info_version() {
    printf '%s' "$RELEASE_INFO" |
        sed -n 's/.*"latestVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' |
        sed 's/^v//'
}

# Published sha256 of a release asset from RELEASE_INFO, or nothing.
release_info_digest() {
    asset_re=$(printf '%s' "$1" | sed 's/[][\.*^$/]/\\&/g')
    printf '%s' "$RELEASE_INFO" |
        sed -n "s/.*\"${asset_re}\"[[:space:]]*:[[:space:]]*\"\([0-9a-f]\{64\}\)\".*/\1/p"
}

# sha256 of a file, with whichever tool this system has.
sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | awk '{print $1}'
    elif command -v sha256 >/dev/null 2>&1; then
        sha256 -q "$1"
    elif command -v openssl >/dev/null 2>&1; then
        openssl dgst -sha256 "$1" | awk '{print $NF}'
    else
        return 1
    fi
}

# Check a downloaded file against the checksum published for its release
# asset. Exits on a mismatch; warns and carries on when there's no published
# checksum (pinned older version, or the API was unreachable).
verify_checksum() {
    checksum_file="$1"
    checksum_asset="$2"

    checksum_expected=$(release_info_digest "$checksum_asset")
    if [ -z "$checksum_expected" ]; then
        print_warning "No published checksum for ${checksum_asset}; skipping verification."
        return 0
    fi

    checksum_actual=$(sha256_of "$checksum_file" || true)
    if [ -z "$checksum_actual" ]; then
        print_warning "No sha256 tool found (sha256sum, shasum, sha256 or openssl); skipping verification."
        return 0
    fi

    if [ "$checksum_actual" != "$checksum_expected" ]; then
        print_error "Checksum mismatch for ${checksum_asset}!"
        print_error "  expected: ${checksum_expected}"
        print_error "  got:      ${checksum_actual}"
        print_error "The download may be corrupted or tampered with. Nothing was installed."
        exit 1
    fi

    print_status "Checksum verified (sha256 ${checksum_expected})"
}

# Parse command line arguments into REQUESTED_VERSION.
parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --version)
                if [ -z "$2" ]; then
                    print_error "--version requires a value"
                    exit 1
                fi
                REQUESTED_VERSION="$2"
                shift
                ;;
            --version=*)
                REQUESTED_VERSION="${1#--version=}"
                ;;
            *)
                print_warning "Ignoring unknown argument: $1"
                ;;
        esac
        shift
    done
}

# Set VERSION and BASE_URL for the release to install: the requested version,
# else the latest from the Fossorial API, else GitHub's latest release (which
# is a plain redirect, not a rate-limited GitHub API call). RELEASE_INFO is
# cleared unless it describes the chosen version, so its checksums are only
# ever used for the release they belong to.
resolve_release() {
    latest=""
    if fetch_release_info; then
        latest=$(release_info_version)
    fi

    if [ -n "$REQUESTED_VERSION" ]; then
        VERSION=$(printf '%s' "$REQUESTED_VERSION" | sed 's/^v//')
        case "$VERSION" in
            ""|*[!0-9A-Za-z.+-]*)
                print_error "Invalid version: ${REQUESTED_VERSION}"
                exit 1
                ;;
        esac
        print_status "Requested version: v${VERSION}"
        BASE_URL="https://github.com/${REPO}/releases/download/${VERSION}"
        if [ "$VERSION" != "$latest" ]; then
            RELEASE_INFO=""
        fi
        return
    fi

    if [ -n "$latest" ]; then
        VERSION="$latest"
        print_status "Latest version: v${VERSION}"
        BASE_URL="https://github.com/${REPO}/releases/download/${VERSION}"
    else
        VERSION=""
        RELEASE_INFO=""
        print_warning "Could not get the latest version from ${RELEASE_API_URL}"
        print_warning "Falling back to the latest release on GitHub"
        BASE_URL="https://github.com/${REPO}/releases/latest/download"
    fi
}

# Detect OS and architecture
detect_platform() {
    local os arch
    
    # Detect OS - only support Linux
    case "$(uname -s)" in
        Linux*)     os="linux" ;;
        *)
            print_error "Unsupported operating system: $(uname -s). Only Linux is supported."
            exit 1
            ;;
    esac
    
    # Detect architecture - only support amd64 and arm64
    case "$(uname -m)" in
        x86_64|amd64)   arch="amd64" ;;
        arm64|aarch64)  arch="arm64" ;;
        *)
            print_error "Unsupported architecture: $(uname -m). Only amd64 and arm64 are supported on Linux."
            exit 1
            ;;
    esac
    
    echo "${os}_${arch}"
}

# Get installation directory
get_install_dir() {
    # Install to the current directory 
    local install_dir="$(pwd)"
    if [ ! -d "$install_dir" ]; then
        print_error "Installation directory does not exist: $install_dir"
        exit 1
    fi
    echo "$install_dir"
}

# Download and install installer
install_installer() {
    local platform="$1"
    local install_dir="$2"
    local binary_name="installer_${platform}"
    
    local download_url="${BASE_URL}/${binary_name}"
    local temp_file="${TMP_DIR}/installer"
    local final_path="${install_dir}/installer"
    
    print_status "Downloading installer from ${download_url}"
    
    # Download the binary
    local download_failed=""
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$download_url" -o "$temp_file" || download_failed=1
    else
        wget -q "$download_url" -O "$temp_file" || download_failed=1
    fi
    if [ -n "$download_failed" ] || [ ! -s "$temp_file" ]; then
        print_error "Failed to download ${download_url}"
        print_error "Check that release ${VERSION:-latest} has a ${binary_name} asset."
        exit 1
    fi

    verify_checksum "$temp_file" "$binary_name"
    
    # Create install directory if it doesn't exist
    mkdir -p "$install_dir"
    
    # Move binary to install directory
    mv "$temp_file" "$final_path"
    
    # Make executable
    chmod +x "$final_path"
    
    print_status "Installer downloaded to ${final_path}"
}

# Verify installation
verify_installation() {
    local install_dir="$1"
    local installer_path="${install_dir}/installer"
    
    if [ -f "$installer_path" ] && [ -x "$installer_path" ]; then
        print_status "Installation successful!"
        return 0
    else
        print_error "Installation failed. Binary not found or not executable."
        return 1
    fi
}

# Main installation process
main() {
    REQUESTED_VERSION="${PANGOLIN_NODE_VERSION:-}"
    parse_args "$@"

    if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
        print_error "Neither curl nor wget is available. Please install one of them."
        exit 1
    fi

    print_status "Downloading installer..."
    
    resolve_release

    TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/pangolin-node.XXXXXX")
    
    # Detect platform
    PLATFORM=$(detect_platform)
    print_status "Detected platform: ${PLATFORM}"
    
    # Get install directory
    INSTALL_DIR=$(get_install_dir)
    print_status "Install directory: ${INSTALL_DIR}"
    
    # Install installer
    install_installer "$PLATFORM" "$INSTALL_DIR"
    
    # Verify installation
    if verify_installation "$INSTALL_DIR"; then
        print_status "Installer is ready to use!"
    else
        exit 1
    fi
}

# Run main function
main "$@"