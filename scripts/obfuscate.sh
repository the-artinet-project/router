#!/bin/bash

# Build the bundle first
echo "Building bundle..."
npm run build:bundle

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Build failed. Exiting."
    exit 1
fi

# Obfuscate the bundle with safe settings that preserve exports
echo "Obfuscating bundle..."
javascript-obfuscator bundle/router-base.js \
  --output bundle/router.js \
  --compact true \
  --reserved-names "exports,module,require,__dirname,__filename,createRouter"\
  --control-flow-flattening false \
  --dead-code-injection false \
  --debug-protection true \
  --debug-protection-interval 2000 \
  --disable-console-output true \
  --identifier-names-generator mangled-shuffled \
  --log false \
  --numbers-to-expressions true \
  --rename-globals false \
  --self-defending false \
  --string-array true \
  --string-array-calls-transform true \
  --string-array-encoding base64 \
  --string-array-index-shift 2 \
  --string-array-rotate true \
  --string-array-shuffle true \
  --string-array-wrappers-count 2 \
  --string-array-wrappers-chained-calls true \
  --string-array-wrappers-parameters-max-count 4 \
  --string-array-wrappers-type function \
  --string-array-threshold 0.8 \
  --transform-object-keys false \
  --unicode-escape-sequence true \
  

# Check if obfuscation was successful
if [ $? -eq 0 ]; then
    echo "Obfuscation completed successfully!"
    echo "Output file: bundle/router.js"
else
    echo "Obfuscation failed!"
    exit 1
fi
