import express, {RequestHandler} from 'express';
import { router as sve } from './sveapi';
import { router as sve_acc } from './accounts_api';
import { router as ai } from './aiapi';
import { router as games } from './gameapi';
import expressWs, {Application} from 'express-ws';
import {SessionOptions} from 'express-session';
import * as session from "express-session";
import { exit } from 'process';
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';

console.log("run server with arguments: ", process.argv);

SVESystemInfo.getInstance().SQLCredentials = {
    MySQL_DB: process.env.SQL_DB || "",
    MySQL_Password: process.env.SQL_Password || "",
    MySQL_User: process.env.SQL_User || "",
};

SVESystemInfo.getInstance().sources.persistentDatabase = process.env.peristentDB || 'localhost';

SVESystemInfo.getInstance().sources.volatileDatabase = process.env.volatileDB || 'mongodb://localhost:27017/sve';
SVESystemInfo.getInstance().sources.sveDataPath = process.env.sveDataPath || '/mnt/MediaStorage/SnowVisionData';

SVESystemInfo.initSystem().then((val) => {
    console.log('SVE System status: ' + JSON.stringify(SVESystemInfo.getSystemStatus()) + ' and isServer = ' + SVESystemInfo.getIsServer() + '!');
}, (val) => {
    console.log('SVE System initialization failed: ' + JSON.stringify(val) + '!');
    exit(-1);
});

let opts: SessionOptions = {
    name: 'sve-session',
    secret: process.env.SECRET || "sadz456&&S(Dcn0eiasufzhaiesufzaipfuz",
    cookie: {
        secure: false,
        sameSite: true
    },
    resave: true,
    saveUninitialized: true
};
var sess: RequestHandler = session.default(opts);

let servers: Map<string, [express.Router, number]> = new Map<string, [express.Router, number]>();
servers.set("media", [sve, Number(process.env.SVE_PORT) || 80]);
servers.set("accounts", [sve_acc, Number(process.env.ACCOUNT_PORT) || 81]);
servers.set("ai", [ai, Number(process.env.AI_PORT) || 82]);
servers.set("games", [games, Number(process.env.GAME_PORT) || 83]);

process.argv.forEach(function (val, index, array) {
    if (servers.has(val)) {
        const app: Application = expressWs(express()).app;
        app.use(sess);
        app.use('/', servers.get(val)![0]);
        app.listen(servers.get(val)![1], function () {
            console.log('SVE ' + val + ' API is listening on port ' + String(servers.get(val)![1]) + '!');
        });
    }
});