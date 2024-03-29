import express, {RequestHandler, Express as ExpressApp} from 'express';
import { Initializer as sve } from './sveapi';
import { Initializer as sve_acc } from './accounts_api';
import { Initializer as ai } from './aiapi';
import { Initializer as games } from './gameapiInit';
import {SessionOptions} from 'express-session';
import * as session from "express-session";
import { exit } from 'process';
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import * as http from 'http';
import sio from 'socket.io';
//import cors from 'cors';

// tslint:disable-next-line: no-console
console.log("run server with arguments: ", process.argv);

process.argv.forEach((val) => {
    if (val === "--test") {
        // tslint:disable-next-line: no-console
        console.log("WARNING: ENABLE TEST MODE");
        process.env.testMode = "true";
    }
})

if(process.env.testMode !== "true") {
    SVESystemInfo.getInstance().SQLCredentials = {
        MySQL_DB: process.env.SQL_DB || "",
        MySQL_Password: process.env.SQL_Password || "",
        MySQL_User: process.env.SQL_User || "",
    };

    SVESystemInfo.getInstance().sources.persistentDatabase = process.env.peristentDB || 'localhost';

    SVESystemInfo.getInstance().sources.volatileDatabase = process.env.volatileDB || 'mongodb://localhost:27017/sve';
    SVESystemInfo.getInstance().sources.sveDataPath = process.env.sveDataPath || '/mnt/MediaStorage/SnowVisionData';

    SVESystemInfo.initSystem().then((val) => {
        // tslint:disable-next-line: no-console
        console.log('SVE System status: ' + JSON.stringify(SVESystemInfo.getSystemStatus()) + ' and isServer = ' + SVESystemInfo.getIsServer() + '!');
    }, (val) => {
        // tslint:disable-next-line: no-console
        console.log('SVE System initialization failed: ' + JSON.stringify(val) + '!');
        exit(-1);
    });
}

const opts: SessionOptions = {
    name: 'sve-session',
    secret: process.env.SECRET || "sadz456&&S(Dcn0eiasufzhaiesufzaipfuz",
    cookie: {
        secure: false,
        sameSite: true
    },
    resave: true,
    saveUninitialized: true
};
const sess: RequestHandler = session.default(opts);

const servers: Map<string, [any, number]> = new Map<string, [any, number]>();
servers.set("media", [sve, Number(process.env.SVE_PORT) || 80]);
servers.set("accounts", [sve_acc, Number(process.env.ACCOUNT_PORT) || 81]);
servers.set("ai", [ai, Number(process.env.AI_PORT) || 82]);
servers.set("games", [games, Number(process.env.GAME_PORT) || 83]);

process.argv.forEach((val, index, array) => {
    if (servers.has(val)) {
        const app: ExpressApp = express();
        app.use(sess);
        if(process.env.testMode === "true") {
            /*app.use(cors({
                origin: "*",
                preflightContinue: true,
                allowedHeaders: "*",
                credentials: true,
                methods: "*"
            }));*/
        }
        const server = http.createServer(app);
        server.listen(servers.get(val)![1], () => {
            // tslint:disable-next-line: no-console
            console.log('SVE ' + val + ' API is listening on port ' + String(servers.get(val)![1]) + '!');
        });
        const serverIO = undefined; /* sio(server, {
            transports:["websocket", 'polling']
        } as sio.ServerOptions).listen(server);*/
        servers.get(val)![0].init(app, serverIO);
    }
});