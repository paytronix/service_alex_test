#!/bin/sh
set -e

SCRIPT_NAME=/ping
SCRIPT_FILENAME=/ping
REQUEST_METHOD=GET

export SCRIPT_NAME SCRIPT_FILENAME REQUEST_METHOD

if cgi-fcgi -bind -connect 127.0.0.1:9000 2>/dev/null | grep -q "pong"; then
    exit 0
fi

exit 1
