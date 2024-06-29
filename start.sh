#!/bin/bash

screen -AmdS SQUAD_RCON_PROXY bash -c 'while [ true ]; do npm start; echo "# SERVER HAS CRASHED: IT WILL BE RESTARTED"; done'