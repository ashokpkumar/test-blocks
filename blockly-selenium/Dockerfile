# The hosted runner behind becomeaiengg.com/blockly-runner/: runs visitors' tests
# in headless Chromium on the server, so the project page needs no setup at all.
FROM python:3.12-slim

# Chromium + its matching driver from Debian (no Selenium Manager download at
# runtime), plus fonts so pages and emoji render in screenshots.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium chromium-driver fonts-dejavu-core fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Visitors control this browser, so it never runs as root.
RUN useradd --create-home bot && chown -R bot /app
USER bot

ENV BLOCKBOTS_SERVER=1 \
    CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER=/usr/bin/chromedriver \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "8000"]
