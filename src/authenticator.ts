import { Request, Response, Router } from "express";
import ServerHelper from './serverhelper';
import {Token, TokenType, SVEAccount as SVEBaseAccount, SVEGroup as SVEBaseGroup, APIStatus, TokenInfo} from 'svebaselib';
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import {SVEServerGroup as SVEGroup} from './serverBaseLib/SVEServerGroup';
import {SVEServerAccount as SVEAccount} from './serverBaseLib/SVEServerAccount';
import {SVEServerToken as SVEToken} from './serverBaseLib/SVEServerToken';

const router = Router();
const apiVersion = 1;

ServerHelper.setupRouter(router);

router.get('/check', (req: Request, res: Response) => {
    const status: APIStatus = {
        status: SVESystemInfo.getSystemStatus().basicSystem && SVESystemInfo.getSystemStatus().tokenSystem,
        version: "2.0"
    };

    SVEAccount.getByRequest(req).then((user: SVEBaseAccount) => {
        status.loggedInAs = user.getInitializer();
        res.json(status);
    }, err => {
        res.json(status);
    });
});

router.post('/token/new', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const tokenType: TokenType = Number(req.body.type) as TokenType;
        const targetID: number = Number(req.body.target);
        if(isNaN(targetID)) {
            res.sendStatus(400);
            return;
        }
        if(tokenType === TokenType.DeviceToken) {
            console.log("Create token for user device: " + user.getName());
            SVEToken.register(user, tokenType, user, (req.useragent !== undefined) ? (req.useragent!.os + ": " + req.useragent!.browser) : "Unknown").then(token => {
                res.json({
                    token: token
                });
            }, err => res.sendStatus(500));
        } else {
            if (tokenType === TokenType.RessourceToken) {
                const g = new SVEGroup({id: targetID}, user, (group) => {
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

router.post('/token/validate', (req: Request, res: Response) => {
    if (req.body.type !== undefined && req.body.target !== undefined && req.body.token !== undefined) {
        const tokenType: TokenType = Number(req.body.type) as TokenType;
        const targetID: number = Number(req.body.target);
        if(isNaN(targetID)) {
            res.sendStatus(400);
            return;
        }
        const token = req.body.token as string;
        SVEToken.tokenExists(tokenType, token, targetID).then(val => {
            res.sendStatus(val ? 204 : 404);
        }, err => res.sendStatus(500));
    } else {
        res.sendStatus(400);
    }
});

router.delete('/token', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        if (req.body.type !== undefined && req.body.target !== undefined && req.body.token !== undefined) {
            const tokenType: TokenType = Number(req.body.type) as TokenType;
            const targetID: number = Number(req.body.target);
            if(isNaN(targetID)) {
                res.sendStatus(400);
                return;
            }
            const token = req.body.token as string;

            SVEToken.remove(tokenType, token, targetID).then(val => {
                res.sendStatus(val ? 204 : 404);
            });
        } else {
            if (req.body.tokenInfo !== undefined) {
                if (user.getID() === Number(req.body.tokenInfo.target) || user.getName() === req.body.tokenInfo.name) {
                    SVEToken.removeByInfo(req.body.tokenInfo as TokenInfo).then(val => {
                        res.sendStatus(val ? 204 : 404);
                    });
                } else {
                    res.sendStatus(401);
                }
            } else {
                res.sendStatus(400);
            }
        }
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/token/devices', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        SVEToken.getAll(TokenType.DeviceToken, user).then(tks => {
            res.json(tks);
        }, err => {
            res.sendStatus(500);
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/token/ressources', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        SVEToken.getAll(TokenType.RessourceToken, user).then(tks => {
            res.json(tks);
        }, err => {
            res.sendStatus(500);
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.post('/token/use', (req: Request, res: Response) => {
    if (req.body.type !== undefined && req.body.target !== undefined && req.body.token !== undefined) {
        const token = req.body as Token;
        if(isNaN(token.target)) {
            res.sendStatus(400);
            return;
        }

        SVEToken.tokenExists(token.type, token.token, token.target).then(val => {
            if(val) {
                SVEToken.use(token.type, token.token, token.target).then(val => {
                    if (token.type === TokenType.RessourceToken) {
                        SVEAccount.getByRequest(req).then((user) => {
                            const g = new SVEGroup({id: token.target}, user, group => {
                                if(group !== undefined && !isNaN(group!.getID())) {
                                    (group! as SVEGroup).getRightsForUser(user).then(rights => {
                                        (group! as SVEGroup).setRightsForUser(user, {
                                            admin: rights.admin,
                                            write: rights.write,
                                            read: true
                                        });
                                    });
                                }
                                SVEToken.remove(token.type, token.token, token.target).then(val => {});
                                res.sendStatus((val !== undefined) ? 204 : 404);
                            });
                        }, err => res.sendStatus(401));
                    } else {
                        if (token.type === TokenType.DeviceToken) {
                            SVEAccount.makeLogin(val.name, val.target).then(user => {
                                if (user !== undefined) {
                                    res.json(user.getInitializer());
                                } else {
                                    res.sendStatus(404);
                                }
                            }, err => res.sendStatus(501));
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