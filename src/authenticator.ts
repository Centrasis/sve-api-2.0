import ServerHelper from './serverhelper';
import {Token, TokenType} from 'svebaselib';

var express = require('express');
var router = express.Router();
const apiVersion = 1;

ServerHelper.setupRouter(router);

/*
router.post('/', function (req: any, res: any) {
    if (req.body.user && req.body.ressource) {
        let data = new SVEData();
        data.createTokenFor(req.body.ressource, req.body.user).then((token: Token) => {
            res.json({
                user: token.user,
                token: token.token,
                ressource: token.ressource,
                type: token.type,
                time: new Date()
            });
        }, (err) => {
            res.status(500).send(JSON.stringify(err));
        });
    } else {
        console.log("Wrong Body: " + JSON.stringify(req.body));
        res.status(400).send("Bad request!");
    }
});

router.get('/', function (req: any, res: any) {
    if(req.query.token && req.query.ressource) {
        let data = new SVEData();
        data.doTokenLogin({
            token: req.query.token,
            ressource: req.query.ressource,
            user: "",
            type: TokenType.RessourceToken,
            time: new Date()
        }).then((value: TokenType) => {
            res.json({
                success: true
            });
        }, (err) => {
            res.status(400).send("Bad request token!");
        });
    } else {
        res.status(400).send("Bad request!");
    }
});
*/

export {
    router,
    apiVersion
};