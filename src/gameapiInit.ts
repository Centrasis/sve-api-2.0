import {games, router} from './gameapi';
import {Application as ExpressApp, WebsocketRequestHandler} from 'express-ws';
import { SVEServerAccount } from './serverBaseLib/SVEServerAccount';
import { GameRejectReason } from 'svegamesapi';


const handlerWS: WebsocketRequestHandler = (ws, req) => {
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
                    ws.close(Number(GameRejectReason.GameFull));
                });
            };
        };
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