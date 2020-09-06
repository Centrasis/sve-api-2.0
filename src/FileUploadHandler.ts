import * as socketio from "socket.io";
import * as path from "path";
import express, { Request, Response, Express } from "express";
import { Server as HttpServer } from 'http';

export class FileUploadHandler {
    protected server: socketio.Server;
    constructor(server: HttpServer) {
        this.server = socketio.listen(server);
        this.server.on("connection", (socket: socketio.Socket) => {

            socket.on("message", function(message: any) {
                console.log(message);
            });
        });
    }
}