import {games, router} from './gameapi';
import {Application as ExpressApp, WebsocketRequestHandler} from 'express-ws';
import { SVEServerAccount } from './serverBaseLib/SVEServerAccount';
import { GameRejectReason } from 'svegamesapi';
import * as RawWebSocket from 'ws';

const handlerWS: WebsocketRequestHandler = (ws, req) => {
    SVEServerAccount.getByRequest(req).then((user) => {
        const gameID: string = req.params.gid as string;
        // tslint:disable-next-line: no-console
        console.log("New valid request for game join: " + gameID);
        if(games.has(gameID)) {
            // tslint:disable-next-line: no-console
            console.log("Issue join at: " + gameID);
            const game = games.get(gameID);
            ws.on('open', () => {
                // tslint:disable-next-line: no-console
                console.log("Open Join request...");
                // tslint:disable-next-line: no-empty
                game!.join(user, ws).then(() => {
                    // tslint:disable-next-line: no-console
                    console.log("Join successful!");
                }, err => {
                    ws.close(Number(GameRejectReason.GameFull));
                });
            });
        } else {
            // tslint:disable-next-line: no-console
            console.log("Abort Join request...");
            ws.on('close', (e) => {
                // tslint:disable-next-line: no-console
                console.log("Closed socket!");
            });
            ws.close(GameRejectReason.GameEnded);
        }
    }, err => {
        // tslint:disable-next-line: no-console
        console.log("Invalid game join request!", err);
    });
};

class Initializer {
    public static init(app: ExpressApp) {
        router.ws("/:gid(\\w+)", handlerWS);

        app.use("/", router);
    }
}

export {
    Initializer
}