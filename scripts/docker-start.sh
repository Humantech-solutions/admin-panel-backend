#!/bin/sh

# Run database seeding
echo "Running database seeding..."
node scripts/seedCompanies.js

# Start backend server
echo "Starting backend server..."
exec node src/index.js
