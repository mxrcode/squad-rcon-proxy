#!/bin/bash

screen -S SQUAD_RCON_PROXY -p 0 -X stuff "^C" && echo "[$(date)] SQUAD_RCON_PROXY - Stopped"