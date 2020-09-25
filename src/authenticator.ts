import { Request, Response, Router } from "express";
import ServerHelper from './serverhelper';
import {Token, TokenType, SessionUserInitializer, SVEAccount as SVEBaseAccount, SVEGroup as SVEBaseGroup} from 'svebaselib';
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import {SVEServerData as SVEData} from './serverBaseLib/SVEServerData';
import {SVEServerGroup as SVEGroup} from './serverBaseLib/SVEServerGroup';
import {SVEServerProject as SVEProject} from './serverBaseLib/SVEServerProject';
import {SVEServerAccount as SVEAccount} from './serverBaseLib/SVEServerAccount';
import {SVEServerToken as SVEToken} from './serverBaseLib/SVEServerToken';

var router = Router();
const apiVersion = 1;

ServerHelper.setupRouter(router);

router.post('/token/new', function (req: Request, res: Response) {
    if (req.session!.user) {
        let tokenType: TokenType = req.body.type as TokenType;
        let targetID: number = Number(req.body.target);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            if(tokenType === TokenType.DeviceToken) {

            } else {
                if (tokenType === TokenType.RessourceToken) {
                    new SVEGroup({id: targetID}, user, (group) => {
                        group!.getRightsForUser(user).then(rights => {
                            if (rights.write || rights.admin) {
                                SVEToken.register(tokenType, group as SVEBaseGroup).then(token => {
                                    res.json({
                                        token: token
                                    });
                                }, err => res.sendStatus(500));
                            } else {
                                res.sendStatus(401);
                            }
                        });
                    });
                }
            }
        });
    } else {
        res.sendStatus(401);
    }
});

router.post('/token/validate', function (req: Request, res: Response) {
    if (req.session!.user) {
        let tokenType: TokenType = req.body.type as TokenType;
        let targetID: number = Number(req.body.target);
        let token = req.body.token;
        SVEToken.tokenExists(tokenType, token, targetID).then(val => {
            res.sendStatus(val ? 204 : 404);
        }, err => res.sendStatus(500));
    } else {
        res.sendStatus(401);
    }
});

router.post('/token/use', function (req: Request, res: Response) {
    if (req.session!.user) {
        let tokenType: TokenType = req.body.type as TokenType;
        let targetID: number = Number(req.body.target);
        let token = req.body.token;
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            SVEToken.tokenExists(tokenType, token, targetID).then(val => {
                if(val) {
                    SVEToken.useToken(tokenType, token, targetID).then(val => {
                        if (tokenType == TokenType.RessourceToken) {
                            new SVEGroup({id: targetID}, user, group => {
                                if(group !== undefined && !isNaN(group!.getID()))
                                    group!.setRightsForUser(user, {
                                        admin: false,
                                        write: false,
                                        read: true
                                    });
                            });
                        }
                        res.sendStatus(val ? 204 : 404);
                    }, err => res.sendStatus(500));
                } else {
                    res.sendStatus(404);
                }
            }, err => res.sendStatus(500));
        });
    } else {
        res.sendStatus(401);
    }
});

export {
    router,
    apiVersion
};