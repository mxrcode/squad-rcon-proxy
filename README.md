# squad-rcon-proxy
**RCON Web Proxy for Squad**

This script allows you to create a web proxy to use **RCON** in a **Squad** game. The file *rcon.js* is borrowed from the [SquadJS](https://github.com/Team-Silver-Sphere/SquadJS) project. It was adapted to run in standalone mode.

## Usage
```npm install```

**Configure the script via config.js**

```npm start```

**Request Example:**

```curl -X POST -H "Content-Type: text/plain" -H "Authorization: HTTP_TOKEN" -d "AdminBroadcast Hello World" http://127.0.0.1:17392/rcon```

## Disclaimer
The script is designed as an abstraction, a temporary solution for use in lower-level languages where implementing the Rcon client for Squad takes much longer than using a NodeJS solution.

**squad-rcon-proxy** is provided "as is" without any warranty or guarantee of any kind. The developers are not responsible for any loss or damage caused by the use of this application.

## License
**squad-rcon-proxy** is released under the GNU Lesser General Public License (LGPL-3.0), which means it is free and open-source software that you can use, modify, and distribute. Please refer to the [LICENSE](https://github.com/mxrcode/squad-rcon-proxy/blob/main/LICENSE) file for more details.
