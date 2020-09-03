var express = require('express');
var cookieParser = require('cookie-parser');
var compression = require('compression');
var bodyParser = require('body-parser');

export default class ServerHelper {
    public static setupRouter(app: any) { 
        app.use(bodyParser.json());
        app.use(cookieParser());
        app.use(compression());
        app.use(bodyParser.urlencoded({ extended: false }));
    }
}