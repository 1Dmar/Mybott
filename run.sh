#!/bin/bash
chmod +x ./cloudflared
# Start cloudflared in background
./cloudflared tunnel run --token eyJhIjoiY2Y1YTNjNDA3YTBlNWVkNjY2MzFjNWQ2ZWU4ZDdjMGMiLCJ0IjoiNmFlNjY3ZmEtZDRmMC00YjBmLTgyZDItYTc5MzgyMjE1MWEyIiwicyI6IllUSTFaVFV3T0dVdFpEVmpaaTAwTkRVMExXSmtOekV0WkdJellXWTFOekV6T0RrMCJ9 &

# Install dependencies and start the app
npm install && node server.js
