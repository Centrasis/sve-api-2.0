var cookieParser = require('cookie-parser');
var compression = require('compression');
var bodyParser = require('body-parser');
var zip = require('express-easy-zip');

export default class ServerHelper {
    public static setupRouter(app: any) { 
        app.use(bodyParser.json());
        app.use(cookieParser());
        app.use(compression());
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(zip());
    }
}