#!/bin/sh

# Binding to '' address, so that it is also accessible from other computers.

dev_appserver.py --high_replication --address='' .
