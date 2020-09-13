import { router } from './authenticator';
import { router as sve } from './sveapi';
import express, { Request, Response, RequestHandler } from "express";
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import { Server as HttpServer, createServer as createHTTPServer } from 'http';
import { Server as HttpsServer, createServer as createHTTPSServer } from 'https';
import * as fs from "fs";
import {SessionOptions} from 'express-session';
import * as session from "express-session";
import { exit } from 'process';
import { SVEData } from 'svebaselib';

//var privateKey  = (fs.existsSync('sslcert/server.key')) ? fs.readFileSync('sslcert/server.key', 'utf8') : "";
//var certificate = (fs.existsSync('sslcert/server.crt')) ? fs.readFileSync('sslcert/server.crt', 'utf8') : "";
//var credentials = {key: privateKey, cert: certificate};
const secureServer = (process.env.secure !== undefined && (Boolean(process.env.secure)) || process.env.secure == "1");

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

const app = express();
const httpApp = express();
const port = process.env.PORT || 80;

let opts: SessionOptions = {
    name: 'sve-session',
    secret: "sadz456&&S(Dcn0eiasufzhaiesufzaipfuz",
    cookie: {
        secure: true,
        sameSite: true
    },
    resave: true,
    saveUninitialized: true
};
var sess: RequestHandler = session.default(opts);
app.use(sess);

app.use('/auth', router);

app.use('/api', sve);

//app.use(express.static('public'));

httpApp.get("*", function(req: Request, res: Response) {
    res.redirect('https://' + req.headers.host + req.url);
});

var httpsServer: HttpServer;
if (false) {
    console.log('Secure server: on');
    //httpsServer = createHTTPSServer(credentials, app);
} else {
    console.log('WARNING: Secure server: off');
    httpsServer = createHTTPServer(app);
}

//var sockethandler: SocketHandler = new UploadHandler("/project/:id/data/upload", new SocketHandler(httpsServer, sess));

httpsServer.listen(port, function () {
    console.log('App is listening on port ' + port + '!');
});