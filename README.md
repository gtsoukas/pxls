# pxls
Pixel image server

pxls is not ready for production usage.

This project has some similarities with traditional photo management applications like [Lychee](https://github.com/electerious/Lychee). But, in contrast to the latter, development of pxls focuses on using Artificial Intelligence to retrieve images, e.g. search for text, faces or objects.


## Features
* Original versions of photos remain unchanged
* Chronological photo index
* Browser based photo upload
* Original-file-hash based duplicate detection
* Option for basic text search
* Planned: similar face search
* Planned: object search


## Quick start
1. Install git and Docker.
2. Download
```
git clone https://github.com/gtsoukas/pxls
cd pxls
```
3. Build Docker container
```
docker build -t pxls .
```
4. Create data folder, this is where all image date is stored. Images may already be placed in a sub folder called *masters* or sub folders thereof. e.g.
```
export PXLS_DATA_PATH="${PWD}/data"
mkdir $PXLS_DATA_PATH
```
5. Run pxls server
```
docker run -t -i \
  --name pxls \
  -v ${PXLS_DATA_PATH}:/pxls/data \
  -e PXLS_ANALYZE_TEXT="1" \
  -p 3000:3000 \
  --rm \
  pxls:latest
```
6. Connect with your browser, e.g.
```
http://localhost:3000
```


## Production setup
Install pm2; Run pxls app via start script; access pxls app via reverse proxy setup e.g. with Apache web server. The reverse proxy is responsible for authentication, authorization, logging, and transport encryption.

For users authenticated via basic auth by the reverse proxy, the app will create a separate master folder per user.


## Disabling text search
With text search, words are detected and recognized within images. This feature is activated by default but requires very high compute resources, has a lot of dependencies, and is below human accuracy. Text search can be disabled via environment variable:
```
PXLS_ANALYZE_TEXT=0
```
