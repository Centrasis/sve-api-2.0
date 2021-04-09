import express, {RequestHandler} from 'express';
import {SessionOptions} from 'express-session';
import * as session from "express-session";
import { exit } from 'process';
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import {getGameAPIRouter} from './gameapi';
import * as fs from "fs";

if (process.argv.length <= 2) {
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

    const app: express.Application = express();
    const port = process.env.GAME_PORT || 83;

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
    app.use(sess);

    let games = getGameAPIRouter(express.Router());
    app.use("/", games);

    app.listen(port, function () {
        console.log('SVE Games API is listening on port ' + port + '!');
    });
}