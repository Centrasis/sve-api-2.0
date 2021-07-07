import ServerHelper from './serverhelper';
import {BasicUserInitializer, SVEGroup as SVEBaseGroup, SVEData as SVEBaseData, LoginState, SVEAccount as SVEBaseAccount, TokenType, BasicUserLoginInfo, Token, APIStatus} from 'svebaselib';
import {SVEServerAccount as SVEAccount} from './serverBaseLib/SVEServerAccount';

import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import {SVEServerToken as SVEToken} from './serverBaseLib/SVEServerToken';

import { Application, Request, Response, Router } from "express";
import { router as auth } from './authenticator';

const router = Router();
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

router.get('/user/:id([\\+\\-]?\\d+)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then(loggedUser => {
        const idx = Number(req.params.id);
        const user = new SVEAccount({id: idx} as BasicUserInitializer, (state) => {
            res.json({
                id: user.getID(),
                loginState: user.getLoginState(),
                name: user.getName()
            });
        });
    }, err => res.sendStatus(401));
});

router.post('/user/change/:op([pw|email])', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const operation = req.params.op as string;
        if (operation === "pw") {
            if(req.body.oldPassword !== undefined && req.body.newPassword !== undefined) {
                const oldPw = req.body.oldPassword as string;
                const newPw = req.body.newPassword as string;
                user.changePassword(oldPw, newPw).then(val => {
                    res.sendStatus((val) ? 204 : 400);
                }, err => res.sendStatus(500))
            } else {
                res.sendStatus(400);
            }
        } else {
            if(operation === "email") {
                res.sendStatus(501);
            } else {
                res.sendStatus(501);
            }
        }
    }, err => res.sendStatus(401));
});

router.put('/user/new', (req: Request, res: Response) => {
    if (req.body.newUser !== undefined) {
        const isTemporary: boolean = (req.body.temporary !== undefined && (req.body.temporary as boolean));
        const name: string = req.body.newUser as string;
        if(isTemporary) {
            SVEAccount.registerTemporaryUser(name).then(usr => {
                console.log("Registered temporary user: " + usr.getName());
                res.json(usr.getInitializer());
            }, err => res.sendStatus(500));
        } else {
            if (req.body.newPassword !== undefined && req.body.token !== undefined) {
                const pass: string = req.body.newPassword as string;
                SVEToken.tokenExists(Number(req.body.token.type) as TokenType, req.body.token.token as string, NaN).then(tokenOK => {
                    if(tokenOK) {
                        SVEAccount.registerNewUser({ name: name, pass: pass } as  BasicUserLoginInfo).then(usr => {
                            console.log("Registered new user: " + usr.getName());
                            res.json({
                                success: usr.getState() !== LoginState.NotLoggedIn,
                                user: usr.getName(),
                                id: usr.getID()
                            });
                        }, err => res.sendStatus(400));
                    } else {
                        res.sendStatus(404);
                    }
                }, err => res.sendStatus(500));
            } else {
                res.sendStatus(400);
            }
        }
    } else {
        res.sendStatus(400);
    }
});

router.post('/doLogin', (req: Request, res: Response) => {
    let acc: SVEAccount;
    const onLogin = (user: SVEBaseAccount) => {
        if (user.getState() !== LoginState.NotLoggedIn) {
            console.log("Logged in user: " + user.getName());
            let ret: any = user.getInitializer() as any;
            ret.success = user.getState() !== LoginState.NotLoggedIn;
            res.json(ret);
        } else {
            res.json({
                success: false,
                user: ""
            });
        }
    };

    if (req.body.token !== undefined) {
        acc = new SVEAccount({
            name: (req.body as Token).name as string,
            id: (req.body as Token).target as number,
            token: (req.body as Token).token as string
        }, onLogin);
    } else {
        if (req.body.user && typeof req.body.user === "string") {
            acc = new SVEAccount({
                name: req.body.user as string, 
                pass:req.body.pw as string
            }, onLogin);
        } else {
            res.sendStatus(400);
        }
    }
});

router.use("/auth", auth);

class Initializer {
    public static init(app: Application) {
        app.use("/", router)
    }
}

export {
    Initializer
};