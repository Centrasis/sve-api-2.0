import ServerHelper from './serverhelper';
import { Request, Response, Router } from "express";
import { APIStatus, SessionUserInitializer, SVEAccount, SVESystemInfo } from 'svebaselib';
import { SVEServerAccount } from './serverBaseLib/SVEServerAccount';
import { Action, GameRejectReason, GameState, SVEGameInfo, SVEGameServer } from 'svegamesapi';
import * as ws from 'ws';

class SVEServerGame {
    public info: SVEGameInfo;
    public meta: any;
    public creation = new Date();
    public players: Map<SVEAccount, ws> = new Map<SVEAccount, ws>();

    constructor(host: SVEAccount, info: SVEGameInfo) {
        this.info = info;
        this.info.host = host;
        this.meta = {};
    }

    public join(usr: SVEAccount, w: ws): Promise<void> {
        return new Promise<void>((reject, resolve) => {
            if (this.info.maxPlayers > this.players.size) {
                this.info.playersCount!++;
                this.players.set(usr, w);
                const self = this;

                w.onclose = (e) => {
                    // tslint:disable-next-line: no-console
                    console.log("Leave game: " + self.info.name + "!");
                    self.disconnect(w);
                };

                w.onerror = (e) => {
                    // tslint:disable-next-line: no-console
                    console.log("Error on game connection: " + self.info.name + "!");
                    self.disconnect(w);
                };

                w.onmessage = (e) => {
                    self.broadcast(usr, e.data);
                };

                resolve();
            } else {
                reject();
            }
        });
    }

    public getPlayersList(): SVEAccount[] {
        const list: SVEAccount[] = [];
        this.players.forEach((val, key, m) => {
            list.push(key);
        });

        return list;
    }

    public endGame() {
        this.players.forEach((val, key, m) => {
            // val.close(Number(GameRejectReason.GameEnded));
        });
    }

    public disconnect(w: ws) {
        let toRemove: SVEAccount | undefined;
        this.players.forEach((val, key, m) => {
            if (val === w)
                toRemove = key;
        });

        if (toRemove !== undefined)
            this.players.delete(toRemove);
    }

    public getAsInitializer(): SVEGameInfo {
        const i = this.info;
        i.host = (typeof i.host === "string") ? i.host : i.host.getName();
        return i;
    }

    public broadcast(invoker: SVEAccount, msg: any) {
        this.players.forEach((val, key, m) => {
            val.send(JSON.stringify({
                invoker: invoker.getName(),
                msg
            }));
        });
    }
}

const games: Map<string, SVEServerGame> = new Map<string, SVEServerGame>();
const router: Router = Router();
ServerHelper.setupRouter(router);


router.get("/list", (req, res) => {
    SVEServerAccount.getByRequest(req).then((user) => {
        const retList: SVEGameInfo[] = [];

        games.forEach((val, key, map) => {
            const info = val.getAsInitializer();
            retList.push(info);
        });

        res.json(retList);
    }, err => {
        res.sendStatus(401);
    });
});

router.get("/list/types", (req, res) => {
    SVEServerAccount.getByRequest(req).then((user) => {
        const retList: SVEGameInfo[] = [];

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

router.get('/check', (req: Request, res: Response) => {
    const status: APIStatus = {
        status: false, // SVESystemInfo.getSystemStatus().basicSystem && SVESystemInfo.getSystemStatus().tokenSystem,
        version: "1.0"
    };

    res.json(status);
});

router.get("/players/:gid(\\w+)", (req, res) => {
    SVEServerAccount.getByRequest(req).then((user) => {
        const gameID: string = req.params.gid as string;
        if(games.has(gameID)) {
            const game = games.get(gameID);
            const retList: string[] = [];
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

router.put("/new", (req: Request, res: Response) => {
    SVEServerAccount.getByRequest(req).then((user) => {
        const gi: SVEGameInfo = req.body as SVEGameInfo;
        // tslint:disable-next-line: no-console
        console.log("New game request: ", gi);
        if(gi.maxPlayers !== undefined && gi.name !== undefined && !games.has(gi.name)) {
            gi.host = user;
            games.set(gi.name, new SVEServerGame(user, gi));
            // tslint:disable-next-line: no-console
            console.log("Created new game: " + gi.name);
            res.sendStatus(204);
        } else {
            // tslint:disable-next-line: no-console
            console.log("Rejected new game: " + gi.name);
            res.sendStatus(400);
        }
    }, err => {
        res.sendStatus(401);
    });
});

router.get("/meta/:gid", (req: Request, res: Response) => {
    const gameID: string = req.params.gid as string;
    SVEServerAccount.getByRequest(req).then((user) => {
        if(games.has(gameID)) {
            const game = games.get(gameID);
            res.json(game!.meta);
        } else {
            res.sendStatus(404);
        }
    }, err => {
        res.sendStatus(401);
    });
});

router.put("/meta/:gid", (req: Request, res: Response) => {
    const gameID: string = req.params.gid as string;
    SVEServerAccount.getByRequest(req).then((user) => {
        if(games.has(gameID)) {
            const game = games.get(gameID);
            if (((typeof game!.info.host === "string") ? game!.info.host : game!.info.host.getName()) === user.getName()) {
                game!.meta = req.body as any;
                res.sendStatus(204);
            } else {
                res.sendStatus(401);
            }
        } else {
            res.sendStatus(404);
        }
    }, err => {
        res.sendStatus(401);
    });
});

router.put("/update/:gid(\\w+)", (req: Request, res: Response) => {
    const gameID: string = req.params.gid as string;
    // tslint:disable-next-line: no-console
    console.log("New valid update request for game: " + gameID);
    SVEServerAccount.getByRequest(req).then((user) => {
        if(games.has(gameID)) {
            const game = games.get(gameID);
            if (((typeof game!.info.host === "string") ? game!.info.host : game!.info.host.getName()) === user.getName()) {
                const gi = req.body as SVEGameInfo;
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
        // tslint:disable-next-line: no-console
        console.log("Invalid game update request!");
        res.sendStatus(401);
    });
});

export {
    games,
    router
};