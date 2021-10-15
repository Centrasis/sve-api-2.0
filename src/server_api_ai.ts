import express, {RequestHandler} from 'express';
import { Initializer as ai } from './aiapi';
import {SessionOptions} from 'express-session';
import * as session from "express-session";
import { exit } from 'process';
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';

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
        // tslint:disable-next-line: no-console
        console.log('SVE System status: ' + JSON.stringify(SVESystemInfo.getSystemStatus()) + ' and isServer = ' + SVESystemInfo.getIsServer() + '!');
    }, (val) => {
        // tslint:disable-next-line: no-console
        console.log('SVE System initialization failed: ' + JSON.stringify(val) + '!');
        exit(-1);
    });

    const app: express.Application = express();
    const port = process.env.AI_PORT || 82;

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
    app.use(sess);

    ai.init(app.use('/', ));

    app.listen(port, () => {
        // tslint:disable-next-line: no-console
        console.log('SVE AI API is listening on port ' + port + '!');
    });
} /*else {
    var args = process.argv.slice(2);
    console.log("Serverless mode active! -> " + args[0]);
    if (args[0].trim() == "train") {
        console.log("Configure client..");
        SVESystemInfo.getInstance().sources.persistentDatabase = args[2];
        let list = args[3].split(":");
        SVESystemInfo.getInstance().SQLCredentials = {
            MySQL_DB: "snowvision_db",
            MySQL_Password: list[1],
            MySQL_User: list[0],
        };
        SVESystemInfo.getInstance().sources.sveDataPath = "https://" + args[2] + "/api";
        SVESystemInfo.getInstance().sources.sveService = undefined;
        SVESystemInfo.initSystem().then((val) => {
            console.log("Initialized client..");
            trainNewModel(args[1], true).then(() => {
                console.log("Trained modell!");
            }, err => console.log("Error: " + JSON.stringify(err)));
        }, err => console.log("Setup error: " + err));
    } else {
        if (args[0].trim() == "predict") {
            let model = args[1];
            let dir = args[2];
            let poppredict = (list: string[]) => {
                if (list.length === 0) {
                    return;
                }
                const path = require('path');
                let file = dir + "/" + list.pop() as string;
                //console.log("Predict file: " + file);
                predict(file, model, true).then(p => {
                    console.log(path.basename(file) + " Predicted: " + JSON.stringify(p));
                    poppredict(list);
                });
            };

            let files = fs.readdirSync(dir);
            poppredict(files);
        }
    }
}*/