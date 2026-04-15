#!/bin/bash

# PR Status Synchronization Setup Script
# This script helps you test and set up the PR status sync system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BASE_URL="http://localhost:3000"
DRY_RUN=true

print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "   PR Status Synchronization Setup"
    echo "=========================================="
    echo -e "${NC}"
}

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_dependencies() {
    print_step "Checking dependencies..."

    if ! command -v curl &> /dev/null; then
        print_error "curl is not installed. Please install curl."
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. Output will be raw JSON."
        JQ_AVAILABLE=false
    else
        JQ_AVAILABLE=true
    fi

    print_success "Dependencies checked"
}

test_api_connectivity() {
    print_step "Testing API connectivity..."

    if curl -s --fail "$BASE_URL/api/devin/sessions/status-dashboard" > /dev/null; then
        print_success "API is accessible"
    else
        print_error "Cannot connect to API at $BASE_URL"
        echo "Make sure the application is running and accessible at $BASE_URL"
        exit 1
    fi
}

show_current_status() {
    print_step "Getting current session status..."

    local response=$(curl -s "$BASE_URL/api/devin/sessions/status-dashboard")

    if [ "$JQ_AVAILABLE" = true ]; then
        echo "Current Status Summary:"
        echo "$response" | jq -r '
        "Total Sessions: " + (.summary.totalSessions | tostring) +
        "\nHealth Score: " + (.summary.healthScore | tostring) + "%" +
        "\nTotal Issues: " + (.issues.totalIssues | tostring) +
        "\n- PR Mismatches: " + (.issues.mismatchedPRStates | tostring) +
        "\n- Stuck Sessions: " + (.issues.stuckSessions | tostring) +
        "\n- Old Active: " + (.issues.oldActiveSessions | tostring)
        '

        local issues=$(echo "$response" | jq -r '.issues.totalIssues')
        if [ "$issues" -gt 0 ]; then
            print_warning "Found $issues issues that may need correction"
        else
            print_success "No issues found - system is healthy!"
        fi
    else
        echo "$response"
    fi
}

preview_corrections() {
    print_step "Previewing what would be corrected..."

    local response=$(curl -s "$BASE_URL/api/devin/sessions/bulk-correct")

    if [ "$JQ_AVAILABLE" = true ]; then
        local mismatches=$(echo "$response" | jq -r '.summary.mismatchedSessions')
        echo "Sessions that would be corrected: $mismatches"

        if [ "$mismatches" -gt 0 ]; then
            echo ""
            echo "Planned Corrections:"
            echo "$response" | jq -r '.corrections[] | "- " + .sessionId + ": " + .statusChange + " (" + .reason + ")"'
        else
            print_success "No corrections needed!"
        fi
    else
        echo "$response"
    fi
}

run_bulk_correction() {
    local dry_run=$1

    if [ "$dry_run" = true ]; then
        print_step "Running bulk correction (DRY RUN)..."
        local payload='{"dryRun": true}'
    else
        print_step "Running bulk correction (LIVE)..."
        local payload='{"dryRun": false}'
    fi

    local response=$(curl -s -X POST "$BASE_URL/api/devin/sessions/bulk-correct" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if [ "$JQ_AVAILABLE" = true ]; then
        local success=$(echo "$response" | jq -r '.success')
        local corrected=$(echo "$response" | jq -r '.summary.sessionsCorrected // 0')
        local errors=$(echo "$response" | jq -r '.summary.errorCount // 0')

        if [ "$success" = "true" ]; then
            if [ "$dry_run" = true ]; then
                print_success "Dry run completed - would correct $corrected sessions"
            else
                print_success "Bulk correction completed - corrected $corrected sessions"
            fi
        else
            print_warning "Bulk correction completed with $errors errors"
        fi

        if [ "$corrected" -gt 0 ]; then
            echo ""
            echo "Corrections made:"
            echo "$response" | jq -r '.corrections[] | select(.success == true) | "✓ " + .sessionId + ": " + .statusChange'
        fi

        if [ "$errors" -gt 0 ]; then
            echo ""
            echo "Errors:"
            echo "$response" | jq -r '.errors[]'
        fi
    else
        echo "$response"
    fi
}

test_sync() {
    print_step "Testing real-time sync..."

    local response=$(curl -s "$BASE_URL/api/devin/sessions/pr-status?dry_run=true")

    if [ "$JQ_AVAILABLE" = true ]; then
        local checked=$(echo "$response" | jq -r '.checked')
        local would_update=$(echo "$response" | jq -r '.updated | length')

        print_success "Sync test completed - checked $checked sessions, would update $would_update"
    else
        echo "$response"
    fi
}

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --url URL         Base URL for the API (default: $BASE_URL)"
    echo "  --live            Run actual corrections (default: dry run only)"
    echo "  --status-only     Only show current status, don't run corrections"
    echo "  --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                          # Run full test with dry run"
    echo "  $0 --status-only            # Just show current status"
    echo "  $0 --live                   # Run actual corrections"
    echo "  $0 --url http://prod.com    # Use different base URL"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            BASE_URL="$2"
            shift 2
            ;;
        --live)
            DRY_RUN=false
            shift
            ;;
        --status-only)
            STATUS_ONLY=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_header

    check_dependencies
    test_api_connectivity

    echo ""
    show_current_status

    if [ "${STATUS_ONLY:-false}" = true ]; then
        echo ""
        print_success "Status check complete!"
        exit 0
    fi

    echo ""
    preview_corrections

    echo ""
    run_bulk_correction $DRY_RUN

    echo ""
    test_sync

    echo ""
    print_success "Setup and testing complete!"

    if [ "$DRY_RUN" = true ]; then
        echo ""
        print_warning "This was a dry run. To actually fix the sessions, run:"
        echo "  $0 --live"
    fi

    echo ""
    echo "Next steps:"
    echo "1. Set up automated sync (see docs/PR_STATUS_SYNC.md)"
    echo "2. Monitor the status dashboard: $BASE_URL/api/devin/sessions/status-dashboard"
    echo "3. Check the system health regularly"
}

# Run main function
main "$@"