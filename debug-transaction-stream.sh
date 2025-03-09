#!/bin/bash

# Kill any process using port 9229
echo "Checking for processes using port 9229..."
PID=$(lsof -ti:9229)
if [ ! -z "$PID" ]; then
  echo "Killing process $PID that's using port 9229"
  kill -9 $PID
fi

# Navigate to the transaction-stream package
cd packages/transaction-stream

# Run the dev script with debugging enabled
echo "Starting transaction-stream in debug mode..."
pnpm dev:debug

# This will start the package with the --inspect-brk flag
# which will pause execution at the start of the script
# and wait for a debugger to attach 