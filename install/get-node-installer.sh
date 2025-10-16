#!/bin/bash

# Get installer - Cross-platform installation script
# Usage: curl -fsSL https://raw.githubusercontent.com/fosrl/installer/refs/heads/main/get-installer.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# GitHub repository info
REPO="fosrl/pangolin-node"
GITHUB_API_URL="https://api.github.com/repos/${REPO}/releases/latest"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get latest version from GitHub API
get_latest_version() {
    local latest_info
    
    if command -v curl >/dev/null 2>&1; then
        latest_info=$(curl -fsSL "$GITHUB_API_URL" 2>/dev/null)
    elif command -v wget >/dev/null 2>&1; then
        latest_info=$(wget -qO- "$GITHUB_API_URL" 2>/dev/null)
    else
        print_error "Neither curl nor wget is available. Please install one of them." >&2
        exit 1
    fi
    
    if [ -z "$latest_info" ]; then
        print_error "Failed to fetch latest version information" >&2
        exit 1
    fi
    
    # Extract version from JSON response (works without jq)
    local version=$(echo "$latest_info" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
    
    if [ -z "$version" ]; then
        print_error "Could not parse version from GitHub API response" >&2
        exit 1
    fi
    
    # Remove 'v' prefix if present
    version=$(echo "$version" | sed 's/^v//')
    
    echo "$version"
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
    local temp_file="/tmp/installer"
    local final_path="${install_dir}/installer"
    
    print_status "Downloading installer from ${download_url}"
    
    # Download the binary
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$download_url" -o "$temp_file"
    elif command -v wget >/dev/null 2>&1; then
        wget -q "$download_url" -O "$temp_file"
    else
        print_error "Neither curl nor wget is available. Please install one of them."
        exit 1
    fi
    
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
    print_status "Installing latest version of installer..."
    
    # Get latest version
    print_status "Fetching latest version from GitHub..."
    VERSION=$(get_latest_version)
    print_status "Latest version: v${VERSION}"
    
    # Set base URL with the fetched version
    BASE_URL="https://github.com/${REPO}/releases/download/${VERSION}"
    
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