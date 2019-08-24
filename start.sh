#!/bin/bash

# installation:
# npm install pm2  -g

# list running processes with:
# pm2 list

# log files are stored under
# ~/.pm2/logs
# or can be viewed with pm2 logs

export NODE_ENV=production
export PORT=4003


pm2 start pxls.js --name="pxls"
