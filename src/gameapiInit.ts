import {games, router} from './gameapi';
import {Application as ExpressApp, WebsocketRequestHandler} from 'express-ws';
import * as express from 'express';
import * as WebSocket from 'ws';
import { SVEServerAccount } from './serverBaseLib/SVEServerAccount';


const handlerWS: WebsocketRequestHandler = (ws: WebSocket, req: express.Request, next: express.NextFunction) => {
    SVEServerAccount.getByRequest(req).then((user) => {
        const gameID: string = req.params.gid as string;
        // tslint:disable-next-line: no-console
        console.log("New valid request for game join: " + gameID);
        if(games.has(gameID)) {
            const game = games.get(gameID);
            ws.onopen = (e) => {
                // tslint:disable-next-line: no-console
                console.log("Open Join request...");
                // tslint:disable-next-line: no-empty
                game!.join(user, ws).then(() => {
                    // tslint:disable-next-line: no-console
                    console.log("Join successful!");
                }, err => {
                    // ws.close(Number(GameRejectReason.GameFull));
                });

            };

            ws.onclose = (e) => {
                // tslint:disable-next-line: no-console
                console.log("Leave game: " + gameID + "!");
                game!.disconnect(e.target);
            };

            ws.onerror = (e) => {
                // tslint:disable-next-line: no-console
                console.log("Error on game connection: " + gameID + "!");
                game!.disconnect(e.target);
            };

            ws.onmessage = (e) => {
                game!.broadcast(user, e.data);
            };
        };
    }, err => {
        // tslint:disable-next-line: no-console
        console.log("Invalid game join request!");
    });
};
class Initializer {
    public static init(app: ExpressApp) {
        app.use("/", router);

        app.ws("/:gid(\\w+)", handlerWS);
    }
}

export {
    Initializer
}