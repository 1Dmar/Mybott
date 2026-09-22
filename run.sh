#!/bin/bash

set -euo pipefail

# Install dependencies from the lockfile and start the app
npm ci --omit=dev && node server.js
