# 1. Base Image: Use an official Node.js image.
# Using a specific version is good practice for reproducibility.
FROM node:18-slim

# 2. Install Python and yt-dlp
# Update package lists and install python, pip, and git (git might be useful for some yt-dlp dependencies).
RUN apt-get update && apt-get install -y python3 python3-pip && \
    pip3 install yt-dlp

# 3. Set Working Directory
# Create and set the working directory inside the container.
WORKDIR /usr/src/app

# 4. Copy package files
# Copy package.json and package-lock.json to leverage Docker cache.
COPY package*.json ./

# 5. Install Node.js Dependencies
# Install dependencies defined in package.json.
RUN npm install

# 6. Copy Application Code
# Copy the rest of your application's code.
COPY . .

# 7. Expose Port
# Expose the port the app runs on.
EXPOSE 3000

# 8. Start Command
# Command to run the application.
CMD ["node", "server.js"]
