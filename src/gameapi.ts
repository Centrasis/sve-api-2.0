import ServerHelper from './serverhelper';
import express, { Request, Response } from "express";
import expressWs, {Application} from 'express-ws';
import { SessionUserInitializer, SVEAccount } from 'svebaselib';
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
            val.close(Number(GameRejectReason.GameEnded));
        });
    }

    public getAsInitializer(): SVEGameInfo {
        return this.info;
    }
}

export function setupGameAPI(app: express.Application): Application {
    var games: Map<string, SVEServerGame> = new Map<string, SVEServerGame>();
    ServerHelper.setupRouter(app);
    var wsApp = expressWs(app).app;
    var router = express.Router();

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
            if(gi.host !== undefined && gi.maxPlayers !== undefined && gi.name !== undefined && !games.has(gi.name)) {
                games.set(gi.name, new SVEServerGame(user, gi));
                console.log("Created new game: " + gi.name);
                res.sendStatus(204);
            } else {
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
                if (game!.info.host.getName() === user.getName()) {
                    game!.info = req.body as SVEGameInfo;
                    res.json(game!.getAsInitializer());
                    if (game!.info.state == GameState.Finished) {
                        game!.endGame();
                        games.delete(game!.info.name);
                    }
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

    router.ws("/:gid(\\w+)", function (ws: WebSocket, req) {
        SVEServerAccount.getByRequest(req).then((user) => {
            let gameID: string = req.params.gid as string;
            console.log("New valid request for game join: " + gameID);
            if(games.has(gameID)) {
                let game = games.get(gameID);
                game!.join(user, ws).then(() => {
                }, err => {
                    ws.close(Number(GameRejectReason.GameFull));
                });
            };
        }, err => {
            console.log("Invalid game join request!");
        });
    });

    wsApp.use("/", router);

    return wsApp;
}