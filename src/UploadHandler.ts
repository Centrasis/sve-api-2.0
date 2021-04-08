import * as socketio from "socket.io";
import { Request } from "express";
import * as path from "path";
import {SocketHandler} from "./SocketHandler";
import { pathToRegexp, match, parse, compile } from "path-to-regexp";
import { SessionUserInitializer, SVEAccount, SVEProject, SVESystemInfo } from "svebaselib";
import { userInfo } from "os";
import { SVEServerAccount } from "./serverBaseLib/SVEServerAccount";

export class UploadHandler extends SocketHandler {
    protected innerHandler: SocketHandler;
    protected uri: [RegExp, any[]];

    constructor(uri: string, handler: SocketHandler) {
        super(handler);
        let keys: any[] = [];
        let url = pathToRegexp(uri, keys);
        this.uri = [
            url,
            keys
        ];
        this.innerHandler = handler;
    }

    protected onConnect(socket: socketio.Socket, req: Request) {
        let res: RegExpExecArray | [] = this.uri[0].exec(req.url) || [];
        if (res.length > 1 && res[1] !== null) {
            console.log("Receive file transmission for url: " + req.url + "..");

            SVEServerAccount.getByRequest(req).then((user) => {
                new SVEProject(Number(res[1]), user, (p) => {
                });
            });
        } else {
            super.onConnect(socket, req);
        }
    }
}