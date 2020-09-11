import mysql from 'mysql';
import {SVEAccount, LoginState, SessionUserInitializer, BasicUserInitializer, BasicUserLoginInfo, TokenUserLoginInfo, Token} from 'svebaselib';
import {SVEServerSystemInfo as SVESystemInfo} from './SVEServerSystemInfo';

export class SVEServerAccount extends SVEAccount {
    // if onLogin is set a login will be perfomed. Otherwise the class will only be created
    public constructor(user: SessionUserInitializer | BasicUserLoginInfo | BasicUserInitializer | TokenUserLoginInfo, onLogin?: (state: SVEAccount) => void) {
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
}