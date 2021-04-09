import mysql from 'mysql';
import {SVEAccount, LoginState, SessionUserInitializer, SessionUserInitializerType, BasicUserInitializer, BasicUserLoginInfo, TokenUserLoginInfo} from 'svebaselib';
import {SVEServerSystemInfo as SVESystemInfo} from './SVEServerSystemInfo';
import mongoose from 'mongoose';
import { Request } from "express";

const loginSchema = new mongoose.Schema({
    sessionID: {
        type: String,
        index: { unique: true, expires: 86400 }
    },
    userID: Number,
    userName: String,
    loginState: Number
}, {timestamps: true});
const LoginModel = mongoose.model('LoginToken', loginSchema);

export class SVEServerAccount extends SVEAccount {
    // if onLogin is set a login will be perfomed. Otherwise the class will only be created
    public constructor(user: SessionUserInitializer | BasicUserLoginInfo | BasicUserInitializer | TokenUserLoginInfo, onLogin?: (usr: SVEAccount) => void) {
        super(user, onLogin);
    }

    protected getByID(id: number): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM user WHERE id = ?", [id], (err, results) => {
                if(err) {
                    console.log("SQL error: " + JSON.stringify(err));
                    this.init(LoginState.NotLoggedIn);
                    reject(err);
                } else {
                    this.init(LoginState.NotLoggedIn);
                    this.name = results[0].name;
                    this.id = id;
                    resolve(true);
                }
            });
        });
    }

    public static getByRequest(req: Request): Promise<SVEServerAccount> {
        return new Promise<SVEServerAccount>((resolve, reject) => {
            if (req.session!.user) {
                // we have a valid session!
                let acc = new SVEServerAccount(req.session!.user as SessionUserInitializer, (user: SVEAccount) => {
                    resolve(acc);
                });
            } else {
                let userSessionID: string | undefined = undefined;
                if(req.body !== undefined && (req.body.sessionID !== undefined || (req.body.user !== undefined && req.body.user.sessionID !== undefined))) {
                    userSessionID = (req.body.user !== undefined && req.body.user.sessionID !== undefined) ? req.body.user.sessionID : req.body.sessionID;
                } else {
                    if(req.query.sessionID !== undefined) {
                        userSessionID = req.query.sessionID as string;
                    }
                }

                if (userSessionID !== undefined) {
                    let search: any = { sessionID: userSessionID };
                    LoginModel.find(search, (err, tokens) => {
                        if(err) {
                            console.log("MONGOOSE FIND ERROR:" + JSON.stringify(err));
                            reject();
                        } else {
                            if (tokens.length > 0) {
                                let acc = new SVEServerAccount({
                                    id: (tokens[0] as any).userID,
                                    name: (tokens[0] as any).userName,
                                    loginState: (tokens[0] as any).loginState as LoginState,
                                    sessionID: userSessionID
                                } as SessionUserInitializer, (user: SVEAccount) => {
                                    resolve(acc);
                                });
                            } else {
                                reject();
                            }
                        }
                    });
                } else {
                    reject();
                }
            }  
        });
    }

    public static generateID(): string {
        return [...Array(30)].map(i=>(~~(Math.random()*36)).toString(36)).join('');
    }

    protected doLogin(info: BasicUserLoginInfo): Promise<LoginState> {
        if (!SVESystemInfo.getIsServer()) {
            console.log("Is weirdly Client!");
            return super.doLogin(info)
        } else {
            return new Promise<LoginState>((resolve, reject) => {
                if (typeof SVESystemInfo.getInstance().sources.persistentDatabase !== "string") {
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM user WHERE name = ? AND password = SHA1(?)", [info.name, info.pass], (err, result) => {
                        if(err) {
                            console.log("LOGIN ERROR: " + JSON.stringify(err));
                            reject(this.loginState);
                            return;
                        }

                        this.loginState = (result.length === 1) ? LoginState.LoggedInByUser : LoginState.NotLoggedIn;
                        if (this.loginState === LoginState.LoggedInByUser) {
                            this.sessionID = SVEServerAccount.generateID();
                            this.name = result[0].name;
                            this.id = result[0].id;

                            let t = new LoginModel({
                                sessionID: this.sessionID,
                                userID: this.id,
                                userName: this.name,
                                loginState: Number(this.loginState)
                            });
                            t.save((err, tk) => {
                                if (err) {
                                    console.log("MONGOOSE SAVE ERROR:" + JSON.stringify(err));
                                    reject(this.loginState);
                                } else {
                                    resolve(this.loginState);
                                }
                            });
                        } else {
                            if (result.length > 1) {
                                console.log("ERROR: Double entry! " + JSON.stringify(result));
                            }
                            resolve(this.loginState);
                        }
                    });
                } else {
                    console.log("ERROR: persistentDatabase was NOT connected!");
                    reject(this.loginState);
                }
            });
        }
    }

    public static registerNewUser(login: BasicUserLoginInfo): Promise<SVEAccount> {
        return new Promise<SVEAccount>((resolve, reject) => {
            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT MAX(id) as id FROM user", (idErr, idRes) => {
                if(idErr) {
                    console.log("REGISTER ERROR: " + JSON.stringify(idErr));
                    reject();
                } else {
                    let id = (idRes.length > 0) ? Number(idRes[0].id) + 1 : 0;
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("INSERT INTO user (`id`, `name`, `password`) VALUES (?, ?, SHA1(?))", [id, login.name, login.pass], (err, result) => {
                        if(err) {
                            console.log("REGISTER ERROR: " + JSON.stringify(err));
                            reject();
                        } else {
                            new SVEServerAccount(login, (usr) => resolve(usr));
                        }
                    });
                }
            });
        });
    };
}

export class SVEServerRootAccount extends SVEServerAccount {
    public isRoot: boolean = true;

    constructor() {
        super({id: 0, loginState: LoginState.LoggedInByUser, name: "", sessionID: ""} as SessionUserInitializer);
    }
}