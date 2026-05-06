#!/bin/sh
# Ignore any extra arguments passed by Railway
exec serve -s dist -l "$PORT"
