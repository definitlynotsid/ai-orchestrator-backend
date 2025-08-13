# Stage 1: Use an official Python runtime as a parent image
# We're using a slim version to keep our final package small.
FROM python:3.11-slim

# Stage 2: Set the working directory inside the container
# This is where our application code will live.
WORKDIR /app

# Stage 3: Copy the dependency files first
# This is a clever trick to speed up future builds. Docker will only
# re-run this step if these files change.
COPY requirements.txt .

# Stage 4: Install any needed packages specified in requirements.txt
# This is where we install FastAPI, SQLAlchemy, etc., inside the container.
RUN pip install --no-cache-dir -r requirements.txt

# Stage 5: Copy the rest of your application code into the container
COPY . .

# Stage 6: Expose the port the app runs on (Render provides PORT at runtime)
ARG PORT=8000
ENV PORT=${PORT}
EXPOSE ${PORT}

# Stage 7: Define the command to run your app (bind to Render's PORT)
# Use shell form so ${PORT} is expanded by the shell. Include proxy headers for Render.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips "*"