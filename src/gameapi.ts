import ServerHelper from './serverhelper';
import express, { Request, Response, Router } from "express";
import expressWs, {Application} from 'express-ws';
import { APIStatus, SessionUserInitializer, SVEAccount, SVESystemInfo } from 'svebaselib';
import { SVEServerAccount } from './serverBaseLib/SVEServerAccount';
import { Action, GameRejectReason, GameState, SVEGameInfo, SVEGameServer } from 'svegamesapi';
import WebSocket from 'ws';

class SVEServerGame {
    public info: SVEGameInfo;
    public creation = new Date();
    public players: Map<SVEAccount, WebSocket> = new Map<SVEAccount, WebSocket>();

    constructor(host: SVEAccount, info: SVEGameInfo) {
        this.info = info;
        this.info.host = host;
    }

    public join(usr: SVEAccount, ws: WebSocket): Promise<void> {
        return new Promise<void>((reject, resolve) => {
            if (this.info.maxPlayers > this.players.size) {
                this.info.playersCount!++;
                this.players.set(usr, ws);
                var self = this;
                ws.on('message', function(msg) {
                    self.players.forEach((val, key, m) => {
                        val.send(msg.toString());                      
                    });
                });
                resolve();
            } else {
                reject();
            }
        });
    }

    public getPlayersList(): SVEAccount[] {
        let list: SVEAccount[] = [];
        this.players.forEach((val, key, m) => {  
            list.push(key);
        }); 

        return list;
    }

    public endGame() {
        this.players.forEach((val, key, m) => {
            //val.close(Number(GameRejectReason.GameEnded));
        });
    }

    public getAsInitializer(): SVEGameInfo {
        let i = this.info;
        i.host = (typeof i.host === "string") ? i.host : i.host.getName();
        return i;
    }
}

var games: Map<string, SVEServerGame> = new Map<string, SVEServerGame>();
var router: Router = Router();
ServerHelper.setupRouter(router);


router.get("/list", (req, res) => {
    SVEServerAccount.getByRequest(req).then((user) => {
        let retList: SVEGameInfo[] = [];

        games.forEach((val, key, map) => {
            let info = val.getAsInitializer();
            retList.push(info);
        });

        res.json(retList);
    }, err => {
        res.sendStatus(401);
    });
});

router.get("/list/types", (req, res) => {
    SVEServerAccount.getByRequest(req).then((user) => {
        let retList: SVEGameInfo[] = [];

        res.json([
            "Survival",
            "TheGame",
            "Uno",
            "Busdriver",
            "Wizard"
        ]);
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/check', function (req: Request, res: Response) {
    let status: APIStatus = {
        status: false, //SVESystemInfo.getSystemStatus().basicSystem && SVESystemInfo.getSystemStatus().tokenSystem,
        version: "1.0" 
    };

    res.json(status);
});

router.get("/players/:gid(\\w+)", (req, res) => {
    SVEServerAccount.getByRequest(req).then((user) => {
        let gameID: string = req.params.gid as string;
        if(games.has(gameID)) {
            let game = games.get(gameID);
            let retList: string[] = [];
            game!.getPlayersList().forEach((val, key, map) => {
                retList.push(val.getName());
            });

            res.json(retList);
        } else {
            res.sendStatus(404);
        }
    }, err => {
        res.sendStatus(401);
    });
});

router.put("/new", function (req: Request, res: Response) {
    SVEServerAccount.getByRequest(req).then((user) => {
        let gi: SVEGameInfo = req.body as SVEGameInfo;
        console.log("New game request: ", gi);
        if(gi.maxPlayers !== undefined && gi.name !== undefined && !games.has(gi.name)) {
            gi.host = user;
            games.set(gi.name, new SVEServerGame(user, gi));
            console.log("Created new game: " + gi.name);
            res.sendStatus(204);
        } else {
            console.log("Rejected new game: " + gi.name);
            res.sendStatus(400);
        }
    }, err => {
        res.sendStatus(401);
    });
});

router.put("/update/:gid(\\w+)", function (req: Request, res: Response) {
    let gameID: string = req.params.gid as string;
    console.log("New valid update request for game: " + gameID);
    SVEServerAccount.getByRequest(req).then((user) => {
        if(games.has(gameID)) {
            let game = games.get(gameID);
            if (((typeof game!.info.host === "string") ? game!.info.host : game!.info.host.getName()) === user.getName()) {
                let gi = req.body as SVEGameInfo;
                game!.info.id = gi.id;
                game!.info.maxPlayers = gi.maxPlayers;
                game!.info.minPlayers = gi.minPlayers;
                game!.info.name = gi.name;
                game!.info.state = gi.state;

                res.json(game!.getAsInitializer());
                /*if (game!.info.state == GameState.Finished) {
                    game!.endGame();
                    games.delete(game!.info.name);
                }*/
                res.sendStatus(204);
            } else {
                res.sendStatus(401);
            }
        } else {
            res.sendStatus(404);
        }
    }, err => {
        console.log("Invalid game update request!");
        res.sendStatus(401);
    });
});

class Initializer {
    public static init(app: Application | express.Application) {
        expressWs(app);
        (app as Application).use("/", router);
        (app as Application).ws("/:gid(\\w+)", function (ws: WebSocket, req) {
            SVEServerAccount.getByRequest(req).then((user) => {
                let gameID: string = req.params.gid as string;
                console.log("New valid request for game join: " + gameID);
                if(games.has(gameID)) {
                    let game = games.get(gameID);
                    game!.join(user, ws).then(() => {
                    }, err => {
                        // ws.close(Number(GameRejectReason.GameFull));
                    });
                };
            }, err => {
                console.log("Invalid game join request!");
            });
        });
    }
}

export {
    Initializer
};