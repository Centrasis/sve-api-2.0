import ServerHelper from './serverhelper';
import express, { Request, Response } from "express";
import * as fs from "fs";
import expressWs, {Router, Application, WebsocketMethod} from 'express-ws';
import { SessionUserInitializer, SVEAccount } from 'svebaselib';
import {GameRequest, GameInfo} from 'svebaselib';


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

export function getGameAPIRouter(router: expressWs.Router): expressWs.Router {
    var games: Map<string, SVEGame> = new Map<string, SVEGame>();
    ServerHelper.setupRouter(router);

    router.get("/list", function (req: Request, res: Response) {
        if (req.session!.user) {
            let retList: GameInfo[] = [];

            games.forEach((val, key, map) => {
                let info = val.getAsInitializer();
                info.playersCount = val.players.size;
                retList.push(info);
            });

            res.json(retList);
        } else {
            res.sendStatus(401);
        }
    });

    router.put("/new", function (req: Request, res: Response) {
        if (req.session!.user) {
            new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEAccount) => {
                let gi: GameInfo = req.body as GameInfo;
                if(gi.gameType !== undefined && gi.host !== undefined && gi.maxPlayers !== undefined && gi.name !== undefined && !games.has(gi.name)) {
                    games.set(gi.name, new SVEGame(user, gi));
                    console.log("Created new game: " + gi.name);
                    res.sendStatus(204);
                } else {
                    res.sendStatus(400);
                }
            });
        } else {
            res.sendStatus(401);
        }
    });

    router.get("/join/:gid(\w+)", function (req: Request, res: Response) {
        let gameID: string = req.params.gid as string;
        console.log("New valid request for game: " + gameID);
        if(req.session!.user && games.has(gameID)) {
            new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEAccount) => {
                let game = games.get(gameID);
                game!.join();
                res.json(game!.getAsInitializer());
            });
        } else {
            console.log("Invalid game join request!");
            res.json({
                success: false
            });
        }
    });

    return router;
}