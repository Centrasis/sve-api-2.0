import * as socketio from "socket.io";
import { Request } from "express";
import {SocketHandler} from "./SocketHandler";
import { pathToRegexp } from "path-to-regexp";
import { SVEProject } from "svebaselib";
import { SVEServerAccount } from "./serverBaseLib/SVEServerAccount";

export class UploadHandler extends SocketHandler {
    protected innerHandler: SocketHandler;
    protected uri: [RegExp, any[]];

    constructor(uri: string, handler: SocketHandler) {
        super(handler);
        const keys: any[] = [];
        const url = pathToRegexp(uri, keys);
        this.uri = [
            url,
            keys
        ];
        this.innerHandler = handler;
    }

    protected onConnect(socket: socketio.Socket, req: Request) {
        const res: RegExpExecArray | [] = this.uri[0].exec(req.url) || [];
        if (res.length > 1 && res[1] !== null) {
            console.log("Receive file transmission for url: " + req.url + "..");

            SVEServerAccount.getByRequest(req).then((user) => {
                const _p = new SVEProject(Number(res[1]), user, (p) => {});
            });
        } else {
            super.onConnect(socket, req);
        }
    }
}