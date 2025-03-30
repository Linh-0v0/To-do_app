# Use official Node.js Alpine image
FROM node:20.18.3-alpine
# FROM node:20.18.3

# Set working directory inside container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Run the application
# CMD ["npm", "run", "start"]


# Expose the port NestJS runs on
EXPOSE 3000



# Let the startup script handle migrations
CMD ["sh", "./entrypoint.sh"]

