import express from "express";
var cookieParser = require('cookie-parser');
var compression = require('compression');
var bodyParser = require('body-parser');
var zip = require('express-easy-zip');
import * as ua from 'express-useragent';

export default class ServerHelper {
    public static setupRouter(app: express.Router) { 
        app.use(bodyParser.json());
        app.use(cookieParser());
        app.use(compression());
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(zip());
        app.use(ua.express());
    }
}