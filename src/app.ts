import express, {RequestHandler} from 'express';
import { router as auth } from './authenticator';
import { router as sve } from './sveapi';
import { router as ai } from './aiapi';
import expressWs, {Application} from 'express-ws';
import {SessionOptions} from 'express-session';
import * as session from "express-session";
import { exit } from 'process';
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import {getGameAPIRouter} from './gameapi';

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

const app: Application = expressWs(express()).app;
const port = process.env.PORT || 80;

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

app.use('/auth', auth);

app.use('/api', sve);

app.use('/ai', ai);

let games = getGameAPIRouter(express.Router());
app.use("/games", games);

app.listen(port, function () {
    console.log('App is listening on port ' + port + '!');
});