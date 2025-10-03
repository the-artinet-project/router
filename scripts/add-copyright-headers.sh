#!/bin/bash

# Script to add GPL-3.0 copyright headers to all TypeScript files in src directory
# Usage: ./add-copyright-headers.sh

echo "Adding copyright headers to TypeScript files..."

HEADER="/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: GPL-3.0-only
 */"

# Counter for files processed
count=0

for file in $(find src -name "*.ts" -type f); do
    # Check if file already has copyright header
    if ! head -n 4 "$file" | grep -q "Copyright 2025 The Artinet Project"; then
        echo "Adding header to: $file"
        # Create temporary file with header + original content
        echo -e "$HEADER\n$(cat "$file")" > "$file"
        ((count++))
    else
        echo "Header already exists in: $file"
    fi
done

echo "Processed $count files."
echo "Copyright headers added successfully!"
