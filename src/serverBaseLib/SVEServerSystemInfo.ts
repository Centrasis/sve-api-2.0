import mysql from 'mysql';
import mongoose from 'mongoose';
import {SVESystemInfo, SVESystemState} from 'svebaselib'

class SVEServerSystemInfo extends SVESystemInfo {
    protected constructor() { 
        super();
        SVESystemInfo.isServer = true;
        SVEServerSystemInfo.isServer = true;
    }

    public static initSystem(): Promise<boolean> {
        if(this.getInstance().sources.sveService !== undefined) {
            SVESystemInfo.isServer = false;
            SVEServerSystemInfo.isServer = false;
            return super.initSystem();
        } else {
            SVESystemInfo.isServer = true;
            SVEServerSystemInfo.isServer = true;
            return new Promise<boolean>((resolve, reject) => {
                (SVEServerSystemInfo.instance as SVEServerSystemInfo).systemState = {
                    authorizationSystem: false,
                    basicSystem: false,
                    tokenSystem: false
                };

                var self = (SVEServerSystemInfo.instance as SVEServerSystemInfo);

                if (typeof this.getInstance().sources.persistentDatabase === "string") {
                    console.log("SQL User: '" + this.getInstance().SQLCredentials.MySQL_User + "'");
                    this.getInstance().sources.persistentDatabase = mysql.createConnection({
                        host: this.getInstance().sources.persistentDatabase as string,
                        user: this.getInstance().SQLCredentials.MySQL_User,
                        password: this.getInstance().SQLCredentials.MySQL_Password,
                        database: this.getInstance().SQLCredentials.MySQL_DB,
                        charset: "utf8_general_ci",
                        insecureAuth: false,
                        port: 3306,
                        ssl  : {
                            rejectUnauthorized: false
                        }
                    });
                    
                    if(this.getInstance().sources.persistentDatabase !== undefined) {
                        (this.getInstance().sources.persistentDatabase! as mysql.Connection).connect(function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                self.systemState.basicSystem = true;
                                resolve(true);
                            }
                        });
                    } else {
                        reject(null);
                    }
                }

                if (typeof this.getInstance().sources.volatileDatabase === "string") {
                    mongoose.connect(this.getInstance().sources.volatileDatabase as string, {useNewUrlParser: true, useUnifiedTopology: true}).then((val) => {
                        this.getInstance().sources.volatileDatabase = val;
                        self.systemState.tokenSystem = true;
                    }, (reason) => {
                        console.log("Cannot connect to volatile DB!");
                    });
                }
            });
        }
    }
}

export {
    SVEServerSystemInfo
}