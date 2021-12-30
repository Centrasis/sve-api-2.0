import mysql from 'mysql';
import {SVEAccount, LoginState, SessionUserInitializer, SessionUserInitializerType, BasicUserInitializer, BasicUserLoginInfo, TokenUserLoginInfo, isSessionUserInitializer} from 'svebaselib';
import {SVEServerSystemInfo as SVESystemInfo} from './SVEServerSystemInfo';
import mongoose from 'mongoose';
import { Request } from "express";
import { base64decode } from 'nodejs-base64';
import SocketIO from 'socket.io';

const loginSchema = new mongoose.Schema({
    sessionID: {
        type: String,
        index: { unique: true, expires: 86400 } // 1day
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

    static makeLogin(user: string, id: number): Promise<SVEServerAccount> {
        return new Promise<SVEServerAccount>((resolve, reject) => {
            const sessID = this.generateID();
            LoginModel.create({
                sessionID: sessID,
                userID: id,
                userName: user,
                loginState: LoginState.LoggedInByToken
            }, (err, tk) => {
                if (err) {
                    // tslint:disable-next-line: no-console
                    console.log("MONGOOSE SAVE ERROR:" + JSON.stringify(err));
                    reject();
                } else {
                    const a = new SVEServerAccount({id, name: user, sessionID: sessID, loginState: LoginState.LoggedInByToken} as SessionUserInitializer, usr => {
                        resolve(usr as SVEServerAccount);
                    });
                }
            });
        });
    }

    protected getByID(id: number): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM user WHERE id = ?", [id], (err, results) => {
                if(err) {
                    // tslint:disable-next-line: no-console
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

    public static getByRequest(req: Request | SocketIO.Handshake): Promise<SVEServerAccount> {
        return new Promise<SVEServerAccount>((resolve, reject) => {
            if (process.env.testMode === "true") {
                // tslint:disable-next-line: no-console
                console.log("WARNING: Log in user as test mode user!");
                resolve(new SVEServerAccount({id: -1, loginState: LoginState.LoggedInByUser, name: "Test", sessionID: "1234", token: "1234"}));
                return;
            }
            let userSessionID: string | undefined;
            if("body" in req && req.body !== undefined && (req.body.sessionID !== undefined || (req.body.user !== undefined && req.body.user.sessionID !== undefined))) {
                userSessionID = (req.body.user !== undefined && req.body.user.sessionID !== undefined) ? req.body.user.sessionID : req.body.sessionID;
            } else {
                if(req.query.sessionID !== undefined) {
                    userSessionID = req.query.sessionID as string;
                } else {
                    if ("header" in req && req.header("authorization") !== undefined) {
                        const basicAuthPattern = new RegExp(".*Basic\\W+([\\w\\=]+)");
                        const auth = req.header("authorization")!;
                        if (basicAuthPattern.test(auth)) {
                            const m = basicAuthPattern.exec(auth)!;
                            const basicAuth = m[1];
                            const basicAuthDecoded = base64decode(basicAuth);

                            if (basicAuthDecoded.includes(":")) {
                                const params = basicAuthDecoded.split(":");
                                const user = params[0];
                                const pw = params[1];

                                if (user === "sessionID") {
                                    userSessionID = pw;
                                }
                            }
                        } else {
                            // tslint:disable-next-line: no-console
                            console.log("Request was not BasicAuth!");
                        }
                    } else {
                        if ("headers" in req && (req as SocketIO.Handshake).headers.sessionID !== undefined) {
                            userSessionID = (req as SocketIO.Handshake).headers.sessionID as string;
                        }
                    }
                }
            }

            if (userSessionID !== undefined) {
                LoginModel.where('sessionID').equals(userSessionID).exec((err, tokens) => {
                    if(err) {
                        reject({reason: "Mongoose Error: " + JSON.stringify(err)});
                    } else {
                        if (tokens.length > 0) {
                            const a = new SVEServerAccount({
                                id: (tokens[0] as any).userID,
                                name: (tokens[0] as any).userName,
                                loginState: (tokens[0] as any).loginState as LoginState,
                                sessionID: userSessionID
                            } as SessionUserInitializer, (user: SVEAccount) => {
                                resolve(user as SVEServerAccount);
                            });
                        } else {
                            reject({reason: "Invalid SessionID"});
                        }
                    }
                });
            } else {
                reject({reason: "No Session info found", headers: req.headers, query: req.query});
            }
        });
    }

    public static generateID(): string {
        // tslint:disable-next-line: no-bitwise
        return [...Array(30)].map(i=>(~~(Math.random()*36)).toString(36)).join('');
    }

    protected doLogin(info: BasicUserLoginInfo): Promise<LoginState> {
        if (!SVESystemInfo.getIsServer()) {
            // tslint:disable-next-line: no-console
            console.log("Is weirdly Client!");
            return super.doLogin(info)
        } else {
            return new Promise<LoginState>((resolve, reject) => {
                if (typeof SVESystemInfo.getInstance().sources.persistentDatabase !== "string") {
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM user WHERE name = ? AND password = SHA1(?)", [info.name, info.pass], (err, result) => {
                        if(err) {
                            // tslint:disable-next-line: no-console
                            console.log("LOGIN ERROR: " + JSON.stringify(err));
                            reject(this.loginState);
                            return;
                        }

                        this.loginState = (result.length === 1) ? LoginState.LoggedInByUser : LoginState.NotLoggedIn;
                        if (this.loginState === LoginState.LoggedInByUser) {
                            this.sessionID = SVEServerAccount.generateID();
                            this.name = result[0].name;
                            this.id = result[0].id;

                            LoginModel.create({
                                sessionID: this.sessionID,
                                userID: this.id,
                                userName: this.name,
                                loginState: Number(this.loginState)
                            }, (err2, tk) => {
                                if (err2) {
                                    // tslint:disable-next-line: no-console
                                    console.log("MONGOOSE SAVE ERROR:" + JSON.stringify(err));
                                    reject(this.loginState);
                                } else {
                                    resolve(this.loginState);
                                }
                            });
                        } else {
                            if (result.length > 1) {
                                // tslint:disable-next-line: no-console
                                console.log("ERROR: Double entry! " + JSON.stringify(result));
                            }
                            resolve(this.loginState);
                        }
                    });
                } else {
                    // tslint:disable-next-line: no-console
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
                    // tslint:disable-next-line: no-console
                    console.log("REGISTER ERROR: " + JSON.stringify(idErr));
                    reject();
                } else {
                    const id = (idRes.length > 0) ? Number(idRes[0].id) + 1 : 0;
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("INSERT INTO user (`id`, `name`, `password`) VALUES (?, ?, SHA1(?))", [id, login.name, login.pass], (err, result) => {
                        if(err) {
                            // tslint:disable-next-line: no-console
                            console.log("REGISTER ERROR: " + JSON.stringify(err));
                            reject();
                        } else {
                            const a = new SVEServerAccount(login, (usr) => resolve(usr));
                        }
                    });
                }
            });
        });
    };

    public static registerTemporaryUser(name: string): Promise<SVEAccount> {
        return new Promise<SVEAccount>((resolve, reject) => {
            const a = new SVEServerAccount({
                id: -9,
                loginState: LoginState.LoggedInByToken,
                name,
                sessionID: SVEServerAccount.generateID(),
                requester: undefined
            } as SessionUserInitializer, usr => {
                LoginModel.create({
                    sessionID: usr.getSessionID(),
                    userID: usr.getID(),
                    userName: usr.getName(),
                    loginState: usr.getLoginState()
                }, (err, tk) => {
                    if (err) {
                        // tslint:disable-next-line: no-console
                        console.log("MONGOOSE SAVE ERROR:" + JSON.stringify(err));
                        reject();
                    } else {
                        resolve(usr);
                    }
                });
            });
        });
    }
}

export class SVEServerRootAccount extends SVEServerAccount {
    public isRoot: boolean = true;

    constructor() {
        super({id: 0, loginState: LoginState.LoggedInByUser, name: "", sessionID: ""} as SessionUserInitializer);
    }
}