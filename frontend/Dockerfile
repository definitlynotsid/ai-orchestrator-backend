# Stage 1: Build Stage
# Use an official Node.js runtime. 'alpine' is a lightweight version.
FROM node:18-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first for build caching
COPY package*.json ./

# Install all the project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application for production
RUN npm run build

# Stage 2: Production Stage
# Use a smaller, more secure base image for the final container
FROM node:18-alpine

WORKDIR /app

# Copy only the necessary build artifacts from the 'builder' stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Expose the port the app runs on
EXPOSE 8080

# Define the command to run your app in production
CMD ["npm", "start"]