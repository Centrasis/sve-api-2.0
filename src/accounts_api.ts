import ServerHelper from './serverhelper';
import {BasicUserInitializer, SVEGroup as SVEBaseGroup, SVEData as SVEBaseData, LoginState, SVEProjectType, SessionUserInitializer, SVESystemState, SVEAccount as SVEBaseAccount, SVEDataInitializer, SVEDataVersion, UserRights, QueryResultType, RawQueryResult, GroupInitializer, ProjectInitializer, SVEProjectState, TokenType, BasicUserLoginInfo, SVEDataType, SVELocalDataInfo} from 'svebaselib';
import {SVEServerAccount as SVEAccount} from './serverBaseLib/SVEServerAccount';

import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import {SVEServerToken as SVEToken} from './serverBaseLib/SVEServerToken';
import {apiVersion as authVersion} from './authenticator';

import { Request, Response, Router } from "express";

import { APIStatus } from "./sveapi";

const apiVersion = 1.0;

var router = Router();
ServerHelper.setupRouter(router);

router.get('/check', function (req: Request, res: Response) {
    let status: APIStatus = {
        status: SVESystemInfo.getSystemStatus(),
        version: {
            fileAPI: apiVersion,
            authAPI: authVersion
        }
    };

    SVEAccount.getByRequest(req).then((user: SVEBaseAccount) => {
        status.loggedInAs = user.getInitializer();
        res.json(status);
    }, err => {
        res.json(status);
    });
});

router.get('/user/:id([\\+\\-]?\\d+)', function (req: Request, res: Response) {
    SVEAccount.getByRequest(req).then(loggedUser => {
        let idx = Number(req.params.id);
        let user = new SVEAccount({id: idx} as BasicUserInitializer, (state) => {
            res.json({
                id: user.getID(),
                loginState: user.getLoginState(),
                name: user.getName()
            });
        });
    }, err => res.sendStatus(401));
});

router.post('/user/change/:op([pw|email])', function (req: Request, res: Response) {
    SVEAccount.getByRequest(req).then((user) => {
        let operation = req.params.op as string;
        if (operation === "pw") {
            if(req.body.oldPassword !== undefined && req.body.newPassword !== undefined) {
                let oldPw = req.body.oldPassword as string;
                let newPw = req.body.newPassword as string;
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

router.put('/user/new', function (req: Request, res: Response) {
    if (req.body.newUser !== undefined && req.body.newPassword !== undefined && req.body.token !== undefined) {
        let name: string = req.body.newUser as string;
        let pass: string = req.body.newPassword as string;
        SVEToken.tokenExists(Number(req.body.token.type) as TokenType, req.body.token.token as string, NaN).then(tokenOK => {
            if(tokenOK) {
                SVEAccount.registerNewUser({ name: name, pass: pass } as  BasicUserLoginInfo).then(usr => {
                    req.session!.user = usr;
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
});

router.post('/doLogin', function (req: Request, res: Response) {
    let acc: SVEAccount;
    const onLogin = (user: SVEBaseAccount) => {
        if (user.getState() !== LoginState.NotLoggedIn) {
            req.session!.user = acc;
            console.log("Logged in user: " + req.session!.user.getName());
            let ret: any = user.getInitializer() as any;
            ret.success = user.getState() !== LoginState.NotLoggedIn;
            res.json(ret);
        } else {
            req.session!.user = undefined;
            res.json({
                success: false,
                user: ""
            });
        }
    };

    if (req.body.user && typeof req.body.user === "string") {
        if (req.body.token) {
            acc = new SVEAccount({
                name: req.body.user as string, 
                token:req.body.token as string
            }, onLogin);
        } else {
            acc = new SVEAccount({
                name: req.body.user as string, 
                pass:req.body.pw as string
            }, onLogin);
        }
    } else {
        res.sendStatus(400);
    }
});

export {
    router
};