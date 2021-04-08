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
    SVEAccount.getByRequest(req).then((user) => {
        let tokenType: TokenType = Number(req.body.type) as TokenType;
        let targetID: number = Number(req.body.target);
        if(isNaN(targetID)) {
            res.sendStatus(400);
            return;
        }
        if(tokenType === TokenType.DeviceToken) {
            console.log("Create token for user device: " + user.getName());
            SVEToken.register(user, tokenType, user).then(token => {
                res.json({
                    token: token
                });
            }, err => res.sendStatus(500));
        } else {
            if (tokenType === TokenType.RessourceToken) {
                new SVEGroup({id: targetID}, user, (group) => {
                    group!.getRightsForUser(user).then(rights => {
                        if (rights.write || rights.admin) {
                            SVEToken.register(user, tokenType, group as SVEBaseGroup).then(token => {
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
    }, err => {
        res.sendStatus(401);
    });
});

router.post('/token/validate', function (req: Request, res: Response) {
    if (req.body.type !== undefined && req.body.target !== undefined && req.body.token !== undefined) {
        let tokenType: TokenType = Number(req.body.type) as TokenType;
        let targetID: number = Number(req.body.target);
        if(isNaN(targetID)) {
            res.sendStatus(400);
            return;
        }
        let token = req.body.token as string;
        SVEToken.tokenExists(tokenType, token, targetID).then(val => {
            res.sendStatus(val ? 204 : 404);
        }, err => res.sendStatus(500));
    } else {
        res.sendStatus(400);
    }
});

router.delete('/token', function (req: Request, res: Response) {
    SVEAccount.getByRequest(req).then((user) => {
        if (req.body.type !== undefined && req.body.target !== undefined && req.body.token !== undefined) {
            let tokenType: TokenType = Number(req.body.type) as TokenType;
            let targetID: number = Number(req.body.target);
            if(isNaN(targetID)) {
                res.sendStatus(400);
                return;
            }
            let token = req.body.token as string;

            SVEToken.remove(tokenType, token, targetID).then(val => {
                res.sendStatus(val ? 204 : 404);
            });
        } else {
            res.sendStatus(400);
        }
    }, err => {
        res.sendStatus(401);
    });
});

router.post('/token/use', function (req: Request, res: Response) {
    if (req.body.type !== undefined && req.body.target !== undefined && req.body.token !== undefined) {
        let tokenType: TokenType = req.body.type as TokenType;
        let targetID: number = Number(req.body.target);
        if(isNaN(targetID)) {
            res.sendStatus(400);
            return;
        }
        let token = req.body.token as string;
        
        SVEToken.tokenExists(tokenType, token, targetID).then(val => {
            if(val) {
                SVEToken.use(tokenType, token, targetID).then(val => {
                    if (tokenType == TokenType.RessourceToken) {
                        SVEAccount.getByRequest(req).then((user) => {
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
                        }, err => res.sendStatus(401));
                    } else {
                        if (tokenType == TokenType.DeviceToken) {
                            new SVEAccount({id: targetID, name: "TokenUser", sessionID: SVEAccount.generateID(), loginState: LoginState.LoggedInByToken} as SessionUserInitializer, (user) => {
                                if (user !== undefined) {
                                    req.session!.user = user;
                                    res.json(user.getInitializer());
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