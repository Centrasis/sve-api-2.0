import ServerHelper from './serverhelper';
import express, { Request, Response } from "express";
import * as fs from "fs";
import expressWs, {Router, Application, WebsocketMethod} from 'express-ws';
import { SessionUserInitializer, SVEAccount } from 'svebaselib';
import {SVEGame as SVEBaseGame, GameRequest, GameInfo} from 'svebaselib';


class SVEGame extends SVEBaseGame {
    public creation = new Date();
    public players: Map<SVEAccount, WebSocket> = new Map<SVEAccount, WebSocket>();

    constructor(host: SVEAccount, info: GameInfo) {
        super({ 
            gameState: info.gameState, 
            gameType: info.gameType, 
            host: host.getName(), 
            maxPlayers: info.maxPlayers,
            name: info.name,
            minPlayers: info.minPlayers,
            playersCount: info.playersCount
        });
    }

    public playerJoin(player: SVEAccount, ws: WebSocket) {
        this.broadcastRequest({
            action: "!join",
            invoker: String(player.getID())
        });

        this.players.forEach((val, key, map) => {
            ws.send(JSON.stringify({
                action: "!join",
                invoker: String(key.getID())
            } as GameRequest));
        });

        this.players.set(player, ws);
    }

    public destroy() {
        this.broadcastRequest({
            invoker: this.host,
            action: "!endGame"
        });
    }

    public broadcastRequest(req: GameRequest) {
        this.players.forEach((val, key, map) => {
            SVEGame.sendGameRequest(val, req);
        });
    }

    public static sendGameRequest(ws: WebSocket, req: GameRequest) {
        ws.send(JSON.stringify(req));
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

    router.ws("/join/:gid(\w+)", (ws, req) => {
        ws.on('open', () => {
            let gameID: string = req.params.gid as string;
            console.log("New valid WebSocket request for game: " + gameID);
            if(req.session!.user && games.has(gameID)) {
                new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEAccount) => {
                    let game = games.get(gameID);
                    game!.playerJoin(user, (ws as any) as WebSocket);
                });
            } else {
                console.log("Invalid game join request!");
                ws.close();
            }
        });

        ws.on('close', () => {
            let gameID: string = req.params.gid as string;
            console.log("Closed valid WebSocket request");
            if(req.session!.user && games.has(gameID)) {
                new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEAccount) => {
                    let game = games.get(gameID);
                    if (user.getName() === game!.host) {
                        games.delete(gameID);
                    }
                });
            }
        });

        ws.on('error', (err: any) => {
            console.log("Error on valid WebSocket request: " + JSON.stringify(err));
        });

        ws.on("unexpected-response", (err: any) => {
            console.log("Error unexpected-response: " + JSON.stringify(err));
        });

        ws.on("upgrade", (err?: any) => {
            console.log("Upgrade game request");
        });

        ws.on('message', (msg: string) => {
            let gameID: string = req.params.gid as string;
            if(req.session!.user && games.has(gameID)) {
                new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEAccount) => {
                    try {
                        let game = games.get(gameID);
                        let action: GameRequest = JSON.parse(msg) as GameRequest;
                        action.invoker = user.getName();
                        game!.broadcastRequest(action);
                    } catch (err) {
                        console.log("Error parsing or processing game request: " + JSON.stringify(err));
                    }
                });
            } else {
                console.log("Invalid game message request!");
                ws.close();
            }
        });
    });

    return router;
}