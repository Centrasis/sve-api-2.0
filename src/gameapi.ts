import ServerHelper from './serverhelper';
import express, { Request, Response } from "express";
import * as fs from "fs";
//import expressWs, {Router, Application, WebsocketMethod} from 'express-ws';
import { GameState, SessionUserInitializer, SVEAccount } from 'svebaselib';
import {GameRequest, GameInfo} from 'svebaselib';
import { SVEServerAccount } from './serverBaseLib/SVEServerAccount';


class SVEGame {
    public info: GameInfo;
    public host: SVEAccount;
    public creation = new Date();
    public players: Map<SVEAccount, WebSocket> = new Map<SVEAccount, WebSocket>();

    constructor(host: SVEAccount, info: GameInfo) {
        this.info = info;
        this.info.host = host.getName();
        this.info.playersCount = 1;
        this.host = host;
    }

    public join() {
        if (this.info.maxPlayers > this.info.playersCount!)
            this.info.playersCount!++;
    }

    public getAsInitializer(): GameInfo {
        return this.info;
    }
}

export function getGameAPIRouter(router: express.Router): express.Router {
    var games: Map<string, SVEGame> = new Map<string, SVEGame>();
    ServerHelper.setupRouter(router);

    router.get("/list", function (req: Request, res: Response) {
        SVEServerAccount.getByRequest(req).then((user) => {
            let retList: GameInfo[] = [];

            games.forEach((val, key, map) => {
                let info = val.getAsInitializer();
                retList.push(info);
            });

            res.json(retList);
        }, err => {
            res.sendStatus(401);
        });
    });

    router.put("/new", function (req: Request, res: Response) {
        SVEServerAccount.getByRequest(req).then((user) => {
            let gi: GameInfo = req.body as GameInfo;
            if(gi.gameType !== undefined && gi.host !== undefined && gi.maxPlayers !== undefined && gi.name !== undefined && !games.has(gi.name)) {
                games.set(gi.name, new SVEGame(user, gi));
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
                if (game!.info.host === user.getName()) {
                    game!.info = req.body as GameInfo;
                    res.json(game!.getAsInitializer());
                    if (game!.info.gameState !== GameState.Undetermined) {
                        games.delete(game!.info.name);
                    }
                } else {
                    res.sendStatus(401);
                }
            }
        }, err => {
            console.log("Invalid game join request!");
            res.json({
                success: false
            });
        });
    });

    router.get("/join/:gid(\\w+)", function (req: Request, res: Response) {
        let gameID: string = req.params.gid as string;
        console.log("New valid request for game: " + gameID);
        SVEServerAccount.getByRequest(req).then((user) => {
            if(games.has(gameID)) {
                let game = games.get(gameID);
                game!.join();
                res.json(game!.getAsInitializer());
            };
        }, err => {
            console.log("Invalid game join request!");
            res.sendStatus(404);
        });
    });

    return router;
}