# Use the base image with Node.js 12.16.3
FROM node:12.16.3

# Copy the current directory into the Docker image
COPY . /ubahn-skill-record-processor

# Set working directory for future use
WORKDIR /ubahn-skill-record-processor

# Install the dependencies from package.json
RUN npm install
CMD npm start
