# Use the base image with Node.js 12.16.3
FROM node:12.16.3

# Copy the current directory into the Docker image
COPY . /u-bahn-user-skills-processor

# Set working directory for future use
WORKDIR /u-bahn-user-skills-processor

# Install the dependencies from package.json
RUN npm install
CMD npm start
