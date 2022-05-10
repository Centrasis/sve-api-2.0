import * as socketio from "socket.io";
import { Request, RequestHandler } from "express";
import { Server as HttpServer } from 'http';
import { SessionUserInitializer, SVEAccount } from "svebaselib";
import { SVEServerAccount } from "./serverBaseLib/SVEServerAccount";

export class SocketHandler {
    protected server: socketio.Server;
    protected clientList: Map<socketio.Socket, SVEAccount>;

    constructor(server: HttpServer | SocketHandler, sessionHandler?: RequestHandler) {
        if (server.constructor.name === SocketHandler.name) {
            this.server = (server as SocketHandler).server;
            this.clientList = (server as SocketHandler).clientList;
            return;
        }

        this.clientList = new Map<socketio.Socket, SVEAccount>();
        this.server = new socketio.Server(server as HttpServer);
        /*if(sessionHandler !== undefined)
            this.server.use((socket, next) => sessionHandler(socket.request, socket.resp, next));*/

        const self = this;
        this.server.on("connection", (socket: socketio.Socket) => {
            let req = (socket.request as Request);
            console.log("Session: " + JSON.stringify(req.session));
            SVEServerAccount.getByRequest(req).then((user) => {
                self.clientList.set(socket, user);

                self.onConnect(socket, req);

                socket.on("message", (message: any) => {
                    console.log(message);
                    self.onMessage(socket, message, req);
                });

                socket.on("disconnect", (reason) => {
                    self.onDisconnect(socket);
                });
            });
        });
    }

    protected onMessage(socket: socketio.Socket, message: any, req: Request) {
        
    }

    protected onConnect(socket: socketio.Socket, req: Request) {
        
    }

    protected onDisconnect(socket: socketio.Socket) {
        
    }
}