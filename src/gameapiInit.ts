import {games, router} from './gameapi';
import {Application, NextFunction, Request} from 'express';
import { SVEServerAccount } from './serverBaseLib/SVEServerAccount';
import { GameRejectReason } from 'svegamesapi';
import {Server as SocketIOServer, Socket} from 'socket.io';

class Initializer {
    public static init(app: Application, sio: SocketIOServer) {
        /*sio.on('connection', (client: Socket) => {
            console.log("New connection!");
            SVEServerAccount.getByRequest(client.handshake).then((user) => {
                const gameID: string = client.handshake.headers.gid as string;
                // tslint:disable-next-line: no-console
                console.log("New valid request for game join: " + gameID);
                if(games.has(gameID)) {
                    // tslint:disable-next-line: no-console
                    console.log("Issue join at: " + gameID);
                    const game = games.get(gameID);
                    // tslint:disable-next-line: no-empty
                    game!.join(user, client).then(() => {
                        // tslint:disable-next-line: no-console
                        console.log("Join successful!");
                    }, err => {
                        // tslint:disable-next-line: no-console
                        console.log("Join failed!", err);
                        client.disconnect();
                    });
                } else {
                    // tslint:disable-next-line: no-console
                    console.log("Abort Join request...");
                    client.on('disconnect', (e) => {
                        // tslint:disable-next-line: no-console
                        console.log("Closed socket!");
                    });
                    client.disconnect(true);
                }
            }, err => {
                // tslint:disable-next-line: no-console
                console.log("Invalid game join request!", err);
                client.disconnect(true);
            });
        });*/

        app.use("/", router);
    }
}

export {
    Initializer
}