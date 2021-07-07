import express from "express";
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { json as jsonBody, urlencoded as urlencodedBody } from 'body-parser';
import zip = require('express-easy-zip');
import {express as expressUA} from 'express-useragent';

export default class ServerHelper {
    public static setupRouter(app: express.Router) {
        app.use(jsonBody());
        app.use(cookieParser());
        app.use(compression());
        app.use(urlencodedBody({ extended: false }));
        app.use(zip());
        app.use(expressUA());
    }
}