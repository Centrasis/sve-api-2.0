import mysql from 'mysql';
import {SVEAccount, LoginState, SessionUserInitializer, BasicUserInitializer, BasicUserLoginInfo, TokenUserLoginInfo} from 'svebaselib';
import {SVEServerSystemInfo as SVESystemInfo} from './SVEServerSystemInfo';

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
                            this.name = result[0].name;
                            this.id = result[0].id;
                        } else {
                            if (result.length > 1) {
                                console.log("ERROR: Double entry! " + JSON.stringify(result));
                            }
                        }

                        resolve(this.loginState);
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