import { Request, Response, Router } from "express";
import ServerHelper from './serverhelper';
import {Token, TokenType, SessionUserInitializer, SVEAccount as SVEBaseAccount, SVEGroup as SVEBaseGroup, LoginState} from 'svebaselib';
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
        let tokenType: TokenType = Number(req.body.type) as TokenType;
        let targetID: number = Number(req.body.target);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            if(tokenType === TokenType.DeviceToken) {

                SVEToken.register(tokenType, user).then(token => {
                    res.json({
                        token: token
                    });
                }, err => res.sendStatus(500));
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
                } else {
                    res.sendStatus(501);
                }
            }
        });
    } else {
        res.sendStatus(401);
    }
});

router.post('/token/validate', function (req: Request, res: Response) {
    if (req.body.type !== undefined && req.body.target !== undefined && req.body.token !== undefined) {
        let tokenType: TokenType = Number(req.body.type) as TokenType;
        let targetID: number = Number(req.body.target);
        let token = req.body.token as string;
        SVEToken.tokenExists(tokenType, token, targetID).then(val => {
            res.sendStatus(val ? 204 : 404);
        }, err => res.sendStatus(500));
    } else {
        res.sendStatus(400);
    }
});

router.delete('/token', function (req: Request, res: Response) {
    if (req.session!.user) {
        if (req.body.type !== undefined && req.body.target !== undefined && req.body.token !== undefined) {
            let tokenType: TokenType = Number(req.body.type) as TokenType;
            let targetID: number = Number(req.body.target);
            let token = req.body.token as string;

            SVEToken.remove(tokenType, token, targetID).then(val => {
                res.sendStatus(val ? 204 : 404);
            });
        } else {
            res.sendStatus(400);
        }
    } else {
        res.sendStatus(401);
    }
});

router.post('/token/use', function (req: Request, res: Response) {
    if (req.body.type !== undefined && req.body.target !== undefined && req.body.token !== undefined) {
        let tokenType: TokenType = req.body.type as TokenType;
        let targetID: number = Number(req.body.target);
        let token = req.body.token as string;
        
        SVEToken.tokenExists(tokenType, token, targetID).then(val => {
            if(val) {
                SVEToken.use(tokenType, token, targetID).then(val => {
                    if (tokenType == TokenType.RessourceToken) {
                        if (req.session!.user) {
                            new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
                                new SVEGroup({id: targetID}, user, group => {
                                    if(group !== undefined && !isNaN(group!.getID())) {
                                        (group! as SVEGroup).getRightsForUser(user).then(rights => {
                                            (group! as SVEGroup).setRightsForUser(user, {
                                                admin: rights.admin,
                                                write: rights.write,
                                                read: true
                                            });
                                        });
                                    }
                                    SVEToken.remove(tokenType, token, targetID).then(val => {});
                                    res.sendStatus(val ? 204 : 404);
                                });
                            });
                        } else {
                            res.sendStatus(401);
                        }
                    } else {
                        if (tokenType == TokenType.DeviceToken) {
                            new SVEAccount({id: targetID, name: "TokenUser", sessionID: req.session!.id, loginState: LoginState.LoggedInByToken} as SessionUserInitializer, (user) => {
                                if (user !== undefined) {
                                    req.session!.user = user;
                                    res.sendStatus(204);
                                } else {
                                    res.sendStatus(404);
                                }
                            });
                        } else {
                            res.sendStatus(501);
                        }
                    }
                }, err => res.sendStatus(500));
            } else {
                res.sendStatus(404);
            }
        }, err => res.sendStatus(500));
    } else {
        res.sendStatus(400);
    }
});

export {
    router,
    apiVersion
};