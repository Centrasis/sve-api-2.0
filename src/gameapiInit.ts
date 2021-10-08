import {games, router} from './gameapi';
import expressWs, {Application} from 'express-ws';
import {Application as ExpressApp} from 'express';
import * as WebSocket from 'ws';
import { SVEServerAccount } from './serverBaseLib/SVEServerAccount';

class Initializer {
    public static init(app: Application) {
        expressWs(app as ExpressApp);
        app.use("/", router);
        app.ws("/:gid(\\w+)", (ws: WebSocket, req) => {
            SVEServerAccount.getByRequest(req).then((user) => {
                const gameID: string = req.params.gid as string;
                // tslint:disable-next-line: no-console
                console.log("New valid request for game join: " + gameID);
                if(games.has(gameID)) {
                    const game = games.get(gameID);
                    // tslint:disable-next-line: no-empty
                    game!.join(user, ws).then(() => {
                    }, err => {
                        // ws.close(Number(GameRejectReason.GameFull));
                    });
                };
            }, err => {
                // tslint:disable-next-line: no-console
                console.log("Invalid game join request!");
            });
        });
    }
}

export {
    Initializer
}