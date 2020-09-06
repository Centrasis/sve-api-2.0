import { router } from './authenticator';
import { router as sve } from './sveapi';
import express, { Request, Response } from "express";
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';

var fs = require('fs');
var https = require('https');
var http = require('http');
var privateKey  = fs.readFileSync('sslcert/server.key', 'utf8');
var certificate = fs.readFileSync('sslcert/server.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};
var cookieSession = require('express-session')

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
});

const app = express();
const httpApp = express();
const port = process.env.PORT || 443;

app.use(cookieSession({
    name: 'sve-session',
    secret: "sadz456&&S(Dcn0eiasufzhaiesufzaipfuz",
    cookie: { 
        secure: true,
        SameSite: true
    },
    resave: true,
    saveUninitialized: true
}));

app.use('/auth', router);

app.use('/api', sve);

app.use(express.static('public'));

httpApp.get("*", function(req: Request, res: Response) {
    res.redirect('https://' + req.headers.host + req.url);
});

var httpsServer: any;
if (secureServer) {
    console.log('Secure server: on');
    httpsServer = https.createServer(credentials, app);
} else {
    console.log('WARNING: Secure server: off');
    httpsServer = http.createServer(app);
}

httpsServer.listen(port, function () {
    console.log('App is listening on port ' + port + '!');
});

/*if (httpPort !== undefined) {
    var httpServer = http.createServer(httpApp);
    httpServer.listen(httpPort);
}*/ 