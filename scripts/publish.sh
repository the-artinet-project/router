#!/bin/bash

# Script to publish with stripped-down package.json
# This script builds the bundle, obfuscates it, and publishes with minimal package.json

echo "Building and obfuscating bundle..."
npm run build:obfuscated

if [ $? -ne 0 ]; then
    echo "Build/obfuscation failed. Exiting."
    exit 1
fi

echo "Publishing with stripped-down package.json..."
rm -rf ./publish-temp
mkdir -p ./publish-temp
mkdir -p ./publish-temp/dist
cp -r ./bundle/router.js ./publish-temp/dist/router.js
cp -r ./dist/types ./publish-temp/dist/types
cp -r ./README.md ./publish-temp/README.md
cp -r ./LICENSE ./publish-temp/LICENSE
cp -r ./package-publish.json ./publish-temp/package.json
# Use the stripped-down package.json for publishing
cd ./publish-temp
npm publish --access public #publish #--pack-destination ./publish-temp --package-lock-only=false

# Clean up if needed
rm -rf ./publish-temp

echo "Publishing completed!"
